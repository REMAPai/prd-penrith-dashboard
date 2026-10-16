import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT, jwtVerify } from "jose";
import { callsMatching, query, routeDb } from "@tests/helpers/db";
import { jar, redirect } from "@tests/helpers/next";

vi.mock("@/lib/db", async () => (await import("@tests/helpers/db")).dbMock);
vi.mock("next/headers", async () => (await import("@tests/helpers/next")).nextHeadersMock);
vi.mock("next/navigation", async () => (await import("@tests/helpers/next")).nextNavigationMock);

import { audit, createSession, destroySession, getSession, requireSession, signInUser, type Session } from "@/lib/session";

const SECRET = "unit-test-secret-unit-test-secret-1234";
const key = (s = SECRET) => new TextEncoder().encode(s);
const session: Session = { email: "lily@prd.test", name: "Lily Test", role: "branch_admin", companyId: "prd", branchId: "pen" };
const userRow = { email: "lily@prd.test", name: "Lily Test", role: "branch_admin", company_id: "prd", branch_id: "pen", status: "active" };

const token = (claims: Record<string, unknown>, secret = SECRET, exp: string | number = "1h") =>
  new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(exp).sign(key(secret));

beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", SECRET);
});

describe("createSession", () => {
  it("sets an httpOnly lax cookie holding a verifiable 8 hour token", async () => {
    await createSession(session);
    const jwt = jar.get("prd_session")!.value;
    const { payload } = await jwtVerify(jwt, key());
    expect(payload).toMatchObject({ email: "lily@prd.test", role: "branch_admin" });
    expect(payload.exp! - payload.iat!).toBe(8 * 3600);
    expect(jar.options("prd_session")).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 28800, secure: false });
  });

  it("marks the cookie secure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await createSession(session);
    expect(jar.options("prd_session")).toMatchObject({ secure: true });
  });

  it("refuses to run without a 32 character secret", async () => {
    vi.stubEnv("AUTH_SECRET", "short");
    await expect(createSession(session)).rejects.toThrow(/AUTH_SECRET/);
    vi.stubEnv("AUTH_SECRET", "");
    await expect(createSession(session)).rejects.toThrow(/AUTH_SECRET/);
  });
});

describe("getSession", () => {
  it("returns null without a cookie", async () => {
    expect(await getSession()).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it("returns the user's current row, not the token's claims", async () => {
    routeDb([[/from users/, [{ ...userRow, role: "viewer", name: "Renamed" }]]]);
    jar.set("prd_session", await token({ ...session }));
    expect(await getSession()).toEqual({ email: "lily@prd.test", name: "Renamed", role: "viewer", companyId: "prd", branchId: "pen" });
  });

  it("rejects a token signed with a different secret", async () => {
    routeDb([[/from users/, [userRow]]]);
    jar.set("prd_session", await token({ ...session }, "another-secret-another-secret-another!"));
    expect(await getSession()).toBeNull();
  });

  it("rejects an expired token", async () => {
    routeDb([[/from users/, [userRow]]]);
    jar.set("prd_session", await token({ ...session }, SECRET, Math.floor(Date.now() / 1000) - 60));
    expect(await getSession()).toBeNull();
  });

  it("rejects garbage and unsigned tokens", async () => {
    routeDb([[/from users/, [userRow]]]);
    jar.set("prd_session", "not-a-jwt");
    expect(await getSession()).toBeNull();
    const unsigned = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from(JSON.stringify({ email: userRow.email })).toString("base64url")}.`;
    jar.set("prd_session", unsigned);
    expect(await getSession()).toBeNull();
  });

  it("rejects a valid token for a deactivated user", async () => {
    routeDb([[/from users/, [{ ...userRow, status: "deactivated" }]]]);
    jar.set("prd_session", await token({ ...session }));
    expect(await getSession()).toBeNull();
  });

  it("rejects a valid token whose user no longer exists", async () => {
    routeDb([[/from users/, []]]);
    jar.set("prd_session", await token({ ...session }));
    expect(await getSession()).toBeNull();
  });

  it("returns null when the secret is missing", async () => {
    jar.set("prd_session", await token({ ...session }));
    vi.stubEnv("AUTH_SECRET", "");
    expect(await getSession()).toBeNull();
  });
});

describe("destroySession and requireSession", () => {
  it("deletes the cookie", async () => {
    jar.set("prd_session", "x");
    await destroySession();
    expect(jar.has("prd_session")).toBe(false);
  });

  it("requireSession redirects to /login without a session", async () => {
    await expect(requireSession()).rejects.toMatchObject({ url: "/login" });
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("requireSession returns the session when valid", async () => {
    routeDb([[/from users/, [userRow]]]);
    jar.set("prd_session", await token({ ...session }));
    expect((await requireSession()).email).toBe("lily@prd.test");
  });
});

describe("audit", () => {
  it("inserts a parameterised audit row", async () => {
    await audit("a@b.test", "Sign-in", "detail", "prd", "pen");
    expect(query).toHaveBeenCalledWith(expect.stringMatching(/insert into audit_log/), ["a@b.test", "Sign-in", "detail", "prd", "pen"]);
  });

  it("defaults company and branch to null and allows a null actor", async () => {
    await audit(null, "Sign-in failed", "x");
    expect(query.mock.calls[0][1]).toEqual([null, "Sign-in failed", "x", null, null]);
  });
});

describe("signInUser", () => {
  it("returns null for unknown and deactivated users without creating a session", async () => {
    routeDb([[/from users/, []]]);
    expect(await signInUser("ghost@x.test", "password")).toBeNull();
    routeDb([[/from users/, [{ ...userRow, status: "deactivated" }]]]);
    expect(await signInUser("lily@prd.test", "password")).toBeNull();
    expect(jar.has("prd_session")).toBe(false);
    expect(callsMatching(/audit_log/)).toHaveLength(0);
  });

  it("creates the session, stamps last_login and writes an audit row", async () => {
    routeDb([[/from users/, [userRow]]]);
    const s = await signInUser("LILY@prd.test", "Microsoft Entra");
    expect(s).toEqual(session);
    expect(jar.has("prd_session")).toBe(true);
    expect(callsMatching(/update users set last_login/)).toHaveLength(1);
    const [, params] = callsMatching(/insert into audit_log/)[0];
    expect(params).toEqual(["lily@prd.test", "Sign-in", "Signed in via Microsoft Entra", "prd", "pen"]);
  });
});
