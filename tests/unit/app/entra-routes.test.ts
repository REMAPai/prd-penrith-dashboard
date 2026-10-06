import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Session } from "@/lib/session";
import { makeSession } from "@tests/helpers/fixtures";

const entra = vi.hoisted(() => ({ exchangeCode: vi.fn(), resolveUser: vi.fn() }));
const sess = vi.hoisted(() => ({ audit: vi.fn(), signInUser: vi.fn<(e: string, m: string) => Promise<Session | null>>() }));
vi.mock("@/lib/db", async () => (await import("@tests/helpers/db")).dbMock);
vi.mock("@/lib/session", () => sess);
vi.mock("@/lib/entra", async (orig) => ({ ...(await orig<typeof import("@/lib/entra")>()), exchangeCode: entra.exchangeCode, resolveUser: entra.resolveUser }));

import { GET as callback } from "@/app/api/auth/entra/callback/route";
import { GET as login } from "@/app/api/auth/entra/login/route";

const OIDC = JSON.stringify({ state: "s1", nonce: "n1", verifier: "v1" });
const call = (qs: string, cookie: string | null = `prd_oidc=${encodeURIComponent(OIDC)}`) =>
  callback(new NextRequest(`http://localhost:3100/api/auth/entra/callback${qs}`, cookie ? { headers: { cookie } } : undefined));
const loc = (r: Response) => new URL(r.headers.get("location")!);
const failedWith = (r: Response, text: string) => {
  expect(loc(r).pathname).toBe("/login");
  expect(loc(r).searchParams.get("error")).toContain(text);
};

describe("entra login route", () => {
  it("bounces back to /login when Microsoft sign-in is not enabled", async () => {
    const r = await login();
    expect(loc(r).pathname).toBe("/login");
    expect(loc(r).searchParams.get("error")).toBe("Microsoft sign-in is not enabled");
  });

  it("redirects to Microsoft with PKCE and sets a short-lived httpOnly state cookie", async () => {
    vi.stubEnv("AUTH_ENTRA_ENABLED", "true");
    vi.stubEnv("AUTH_ENTRA_CLIENT_ID", "cid");
    vi.stubEnv("AUTH_ENTRA_CLIENT_SECRET", "sec");
    vi.stubEnv("AUTH_ENTRA_TENANT_ID", "11111111-1111-1111-1111-111111111111");
    vi.stubEnv("AUTH_URL", "http://localhost:3100");
    const r = await login();
    const to = loc(r);
    expect(to.host).toBe("login.microsoftonline.com");
    expect(to.searchParams.get("code_challenge_method")).toBe("S256");
    const cookie = r.cookies.get("prd_oidc")!;
    const { state, nonce, verifier } = JSON.parse(cookie.value);
    expect(to.searchParams.get("state")).toBe(state);
    expect(to.searchParams.get("nonce")).toBe(nonce);
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    const raw = r.headers.get("set-cookie")!.toLowerCase();
    expect(raw).toContain("httponly");
    expect(raw).toContain("path=/api/auth/entra");
    expect(raw).toContain("max-age=600");
  });
});

describe("entra callback route", () => {
  it("fails when Microsoft returns an error, showing only the first line of the description", async () => {
    failedWith(await call("?error=access_denied&error_description=User%20cancelled%0D%0ATrace%20ID%3A%20x"), "User cancelled");
    expect(loc(await call("?error=access_denied")).searchParams.get("error")).toBe("Microsoft sign-in was cancelled");
  });

  it("fails when the state cookie is missing", async () => {
    failedWith(await call("?code=abc&state=s1", null), "Sign-in session expired");
    expect(entra.exchangeCode).not.toHaveBeenCalled();
  });

  it.each(["not json", "null", "[]", JSON.stringify({ state: "s1", nonce: "n1" }), JSON.stringify({ state: "s1", nonce: "", verifier: "v" }), JSON.stringify({ state: 1, nonce: "n", verifier: "v" })])("redirects to /login and clears the cookie for a malformed state cookie %s", async (bad) => {
    const r = await call("?code=abc&state=s1", `prd_oidc=${encodeURIComponent(bad)}`);
    failedWith(r, "invalid");
    expect(r.headers.get("set-cookie")).toMatch(/prd_oidc=;/);
    expect(entra.exchangeCode).not.toHaveBeenCalled();
  });

  it("fails when the code is missing", async () => {
    failedWith(await call("?state=s1"), "Sign-in session expired");
  });

  it("fails on a state mismatch without exchanging the code", async () => {
    failedWith(await call("?code=abc&state=forged"), "state did not match");
    expect(entra.exchangeCode).not.toHaveBeenCalled();
    failedWith(await call("?code=abc"), "state did not match");
  });

  it("shows the exchange error (bad nonce, bad signature, ...)", async () => {
    entra.exchangeCode.mockRejectedValue(new Error("Nonce mismatch"));
    failedWith(await call("?code=abc&state=s1"), "Nonce mismatch");
    entra.exchangeCode.mockRejectedValue("weird");
    failedWith(await call("?code=abc&state=s1"), "Microsoft sign-in failed");
  });

  it("denies unmapped or unauthorised identities and writes an audit row without signing in", async () => {
    entra.exchangeCode.mockResolvedValue({ tid: "t-1", oid: "o", email: "x@evil.test", name: "X" });
    entra.resolveUser.mockResolvedValue({ error: "Your organisation is not set up for this dashboard." });
    failedWith(await call("?code=abc&state=s1"), "not set up");
    expect(sess.audit).toHaveBeenCalledWith("x@evil.test", "Sign-in denied", "Your organisation is not set up for this dashboard. (tenant t-1)");
    expect(sess.signInUser).not.toHaveBeenCalled();
  });

  it("fails when the user turns out to be inactive", async () => {
    entra.exchangeCode.mockResolvedValue({ tid: "t", oid: "o", email: "a@b.test", name: "A" });
    entra.resolveUser.mockResolvedValue({ email: "a@b.test" });
    sess.signInUser.mockResolvedValue(null);
    failedWith(await call("?code=abc&state=s1"), "not active");
  });

  it.each([
    ["branch_admin", "/progress"],
    ["platform_admin", "/companies"],
  ] as const)("signs in a %s and lands on %s, clearing the state cookie", async (role, path) => {
    entra.exchangeCode.mockResolvedValue({ tid: "t", oid: "o", email: "a@b.test", name: "A" });
    entra.resolveUser.mockResolvedValue({ email: "a@b.test" });
    sess.signInUser.mockResolvedValue(makeSession(role));
    const r = await call("?code=abc&state=s1");
    expect(loc(r).pathname).toBe(path);
    expect(sess.signInUser).toHaveBeenCalledWith("a@b.test", "Microsoft Entra");
    expect(entra.exchangeCode).toHaveBeenCalledWith("abc", "v1", "n1");
    expect(r.headers.get("set-cookie")).toMatch(/prd_oidc=;/);
  });
});
