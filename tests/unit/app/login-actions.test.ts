import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import { routeDb, query } from "@tests/helpers/db";
import { redirect } from "@tests/helpers/next";
import { form, makeSession } from "@tests/helpers/fixtures";

const sess = vi.hoisted(() => ({ audit: vi.fn(), destroySession: vi.fn(), signInUser: vi.fn(), getSession: vi.fn() }));
vi.mock("@/lib/db", async () => (await import("@tests/helpers/db")).dbMock);
vi.mock("@/lib/session", () => sess);
vi.mock("next/navigation", async () => (await import("@tests/helpers/next")).nextNavigationMock);

import { passwordLogin, signOut } from "@/app/login/actions";

let hash: string;
beforeAll(async () => {
  hash = await bcrypt.hash("correct horse", 4);
});
afterEach(() => vi.useRealTimers());

const user = (over: Record<string, unknown> = {}) => routeDb([[/from users/, [{ password_hash: hash, status: "active", ...over }]]]);
let n = 0;
const fresh = () => `user${++n}@test.example`; // the limiter is module-level state, so each test uses its own address
const login = (email: string, password: string) => passwordLogin(undefined, form({ email, password }));

describe("passwordLogin", () => {
  it("is refused when the fallback is turned off", async () => {
    vi.stubEnv("AUTH_FALLBACK_ENABLED", "false");
    expect(await login(fresh(), "x")).toEqual({ error: "Password sign-in is turned off. Use Microsoft." });
    expect(query).not.toHaveBeenCalled();
  });

  it("validates input", async () => {
    expect(await passwordLogin(undefined, form({ email: "not-an-email", password: "x" }))).toEqual({ error: "Enter your email and password." });
    expect(await passwordLogin(undefined, form({ email: fresh(), password: "" }))).toEqual({ error: "Enter your email and password." });
    expect(await passwordLogin(undefined, new FormData())).toEqual({ error: "Enter your email and password." });
    expect(await passwordLogin(undefined, form({ email: fresh(), password: "x".repeat(201) }))).toEqual({ error: "Enter your email and password." });
  });

  it("rejects a wrong password and audits the failure without revealing which part was wrong", async () => {
    user();
    const email = fresh();
    expect(await login(email, "nope")).toEqual({ error: "Wrong email or password." });
    expect(sess.audit).toHaveBeenCalledWith(email, "Sign-in failed", "Wrong email or password");
    expect(sess.signInUser).not.toHaveBeenCalled();
  });

  it("gives the same error for an unknown user, an inactive user and a user with no password", async () => {
    const email = fresh();
    routeDb([[/from users/, []]]);
    const unknown = await login(email, "correct horse");
    user({ status: "deactivated" });
    const inactive = await login(email, "correct horse");
    user({ password_hash: null });
    const noPw = await login(email, "correct horse");
    expect([unknown, inactive, noPw]).toEqual(Array(3).fill({ error: "Wrong email or password." }));
    expect(sess.signInUser).not.toHaveBeenCalled();
  });

  it("locks the address after five failures, even for the right password, then recovers after 10 minutes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    user();
    const email = fresh();
    for (let i = 0; i < 5; i++) expect(await login(email, "bad")).toEqual({ error: "Wrong email or password." });
    expect(await login(email, "correct horse")).toEqual({ error: "Too many attempts. Try again in a few minutes." });
    expect(sess.signInUser).not.toHaveBeenCalled();
    vi.setSystemTime(Date.now() + 10 * 60 * 1000 + 1000);
    sess.signInUser.mockResolvedValue(makeSession("branch_admin"));
    await expect(login(email, "correct horse")).rejects.toMatchObject({ url: "/progress" });
  });

  it("counts failures per address, case-insensitively", async () => {
    user();
    const email = fresh();
    for (let i = 0; i < 5; i++) await login(i % 2 ? email.toUpperCase() : email, "bad");
    expect((await login(email, "bad")).error).toContain("Too many");
    expect((await login(fresh(), "bad")).error).toBe("Wrong email or password.");
  });

  it("a success clears earlier failures", async () => {
    user();
    const email = fresh();
    sess.signInUser.mockResolvedValue(makeSession("branch_admin"));
    for (let i = 0; i < 4; i++) await login(email, "bad");
    await expect(login(email, "correct horse")).rejects.toMatchObject({ url: "/progress" });
    for (let i = 0; i < 4; i++) expect((await login(email, "bad")).error).toBe("Wrong email or password.");
  });

  it.each([
    ["branch_admin", "/progress"],
    ["viewer", "/progress"],
    ["platform_admin", "/companies"],
  ] as const)("signs in a %s with the password method and redirects to %s", async (role, path) => {
    user();
    sess.signInUser.mockResolvedValue(makeSession(role));
    const email = fresh();
    await expect(login(email.toUpperCase(), "correct horse")).rejects.toMatchObject({ url: path });
    expect(sess.signInUser).toHaveBeenCalledWith(email, "password");
  });

  it("queries with the lower-cased email as a parameter", async () => {
    user();
    const email = fresh();
    await login(email.toUpperCase(), "bad");
    expect(query.mock.calls[0][1]).toEqual([email]);
  });
});

describe("signOut", () => {
  it("audits, destroys the session and redirects to /login", async () => {
    sess.getSession.mockResolvedValue(makeSession("branch_admin"));
    await expect(signOut()).rejects.toMatchObject({ url: "/login" });
    expect(sess.audit).toHaveBeenCalledWith("branch_admin@test.example", "Sign-out", "Signed out", "prd", "pen");
    expect(sess.destroySession).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("still clears the cookie when there is no session", async () => {
    sess.getSession.mockResolvedValue(null);
    await expect(signOut()).rejects.toMatchObject({ url: "/login" });
    expect(sess.audit).not.toHaveBeenCalled();
    expect(sess.destroySession).toHaveBeenCalled();
  });
});
