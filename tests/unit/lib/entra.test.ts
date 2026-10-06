import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT, exportJWK, generateKeyPair, type JWK } from "jose";
import { callsMatching, query, routeDb } from "@tests/helpers/db";

vi.mock("@/lib/db", async () => (await import("@tests/helpers/db")).dbMock);

// The real function fetches Microsoft's public keys; swap in a local key set so signatures are still really verified.
const jwksHolder = vi.hoisted(() => ({ keys: [] as JWK[] }));
vi.mock("jose", async (orig) => {
  const actual = await orig<typeof import("jose")>();
  return { ...actual, createRemoteJWKSet: () => actual.createLocalJWKSet({ keys: jwksHolder.keys }) };
});

import { authorizeUrl, challengeFor, entraEnabled, exchangeCode, isMultiTenant, randomToken, redirectUri, resolveUser, type EntraIdentity } from "@/lib/entra";

const TID = "11111111-1111-1111-1111-111111111111";
const OTHER_TID = "22222222-2222-2222-2222-222222222222";
const CLIENT = "client-id-for-tests";
let priv: CryptoKey;
let otherPriv: CryptoKey;

beforeAll(async () => {
  const a = await generateKeyPair("RS256");
  const b = await generateKeyPair("RS256");
  priv = a.privateKey;
  otherPriv = b.privateKey;
  jwksHolder.keys = [{ ...(await exportJWK(a.publicKey)), kid: "k1", alg: "RS256", use: "sig" }];
});

beforeEach(() => {
  vi.stubEnv("AUTH_ENTRA_CLIENT_ID", CLIENT);
  vi.stubEnv("AUTH_ENTRA_CLIENT_SECRET", "secret");
  vi.stubEnv("AUTH_ENTRA_TENANT_ID", TID);
  vi.stubEnv("AUTH_URL", "https://dash.test/");
});

describe("config helpers", () => {
  it("entraEnabled needs the flag, client id, secret and a tenant (or multi-tenant)", () => {
    expect(entraEnabled()).toBe(false);
    vi.stubEnv("AUTH_ENTRA_ENABLED", "true");
    expect(entraEnabled()).toBe(true);
    vi.stubEnv("AUTH_ENTRA_TENANT_ID", "");
    expect(entraEnabled()).toBe(false);
    vi.stubEnv("AUTH_ENTRA_MULTITENANT", "true");
    expect(entraEnabled()).toBe(true);
    vi.stubEnv("AUTH_ENTRA_CLIENT_SECRET", "");
    expect(entraEnabled()).toBe(false);
  });

  it("isMultiTenant is true only for the literal 'true'", () => {
    expect(isMultiTenant()).toBe(false);
    vi.stubEnv("AUTH_ENTRA_MULTITENANT", "yes");
    expect(isMultiTenant()).toBe(false);
    vi.stubEnv("AUTH_ENTRA_MULTITENANT", "true");
    expect(isMultiTenant()).toBe(true);
  });

  it("redirectUri strips a trailing slash and defaults to localhost", () => {
    expect(redirectUri()).toBe("https://dash.test/api/auth/entra/callback");
    vi.stubEnv("AUTH_URL", "");
    expect(redirectUri()).toBe("http://localhost:3000/api/auth/entra/callback");
  });

  it("randomToken is url-safe, sized by input and unique", () => {
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken(48)).toHaveLength(64);
    expect(randomToken()).not.toBe(randomToken());
  });

  it("challengeFor matches the RFC 7636 S256 test vector", async () => {
    expect(await challengeFor("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});

describe("authorizeUrl", () => {
  it("targets the configured tenant for a single-tenant app", () => {
    const u = new URL(authorizeUrl("st", "no", "ch"));
    expect(u.origin + u.pathname).toBe(`https://login.microsoftonline.com/${TID}/oauth2/v2.0/authorize`);
    expect(Object.fromEntries(u.searchParams)).toMatchObject({
      client_id: CLIENT,
      response_type: "code",
      redirect_uri: "https://dash.test/api/auth/entra/callback",
      response_mode: "query",
      scope: "openid profile email",
      state: "st",
      nonce: "no",
      code_challenge: "ch",
      code_challenge_method: "S256",
      prompt: "select_account",
    });
  });

  it("targets the organizations endpoint for a multi-tenant app", () => {
    vi.stubEnv("AUTH_ENTRA_MULTITENANT", "true");
    expect(authorizeUrl("s", "n", "c")).toContain("https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize?");
  });
});

type Claims = Record<string, unknown>;
async function idToken(over: Claims = {}, opts: { key?: CryptoKey; iss?: string; aud?: string; exp?: string | number } = {}) {
  const claims: Claims = { tid: TID, oid: "oid-1", preferred_username: "Lily@PRD.net.au", name: "Lily Test", nonce: "nonce-1", ...over };
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(opts.iss ?? `https://login.microsoftonline.com/${claims.tid}/v2.0`)
    .setAudience(opts.aud ?? CLIENT)
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? "5m")
    .sign(opts.key ?? priv);
}
const tokenEndpoint = (body: unknown, ok = true) => vi.stubGlobal("fetch", vi.fn(async () => ({ ok, json: async () => body })));

describe("exchangeCode", () => {
  it("returns the identity for a correctly signed token and lowercases the email", async () => {
    tokenEndpoint({ id_token: await idToken() });
    const id = await exchangeCode("code", "verifier", "nonce-1");
    expect(id).toEqual({ tid: TID, oid: "oid-1", email: "lily@prd.net.au", name: "Lily Test" });
    const [url, init] = vi.mocked(fetch).mock.calls[0] as unknown as [string, { method: string; body: URLSearchParams }];
    expect(url).toBe(`https://login.microsoftonline.com/${TID}/oauth2/v2.0/token`);
    expect(init.method).toBe("POST");
    expect(init.body.get("code_verifier")).toBe("verifier");
    expect(init.body.get("grant_type")).toBe("authorization_code");
  });

  it("falls back to the email claim and then to the email as the name", async () => {
    tokenEndpoint({ id_token: await idToken({ preferred_username: undefined, email: "A@B.test", name: undefined }) });
    expect(await exchangeCode("c", "v", "nonce-1")).toMatchObject({ email: "a@b.test", name: "a@b.test" });
  });

  it("surfaces the first line of Microsoft's error description", async () => {
    tokenEndpoint({ error_description: "AADSTS70008: code expired\r\nTrace ID: abc" }, false);
    await expect(exchangeCode("c", "v", "n")).rejects.toThrow("AADSTS70008: code expired");
  });

  it("fails generically when there is no id_token", async () => {
    tokenEndpoint({}, true);
    await expect(exchangeCode("c", "v", "n")).rejects.toThrow("Token exchange failed");
  });

  it("rejects a token without a tenant id", async () => {
    tokenEndpoint({ id_token: await idToken({ tid: "not-a-guid" }) });
    await expect(exchangeCode("c", "v", "nonce-1")).rejects.toThrow("Token has no tenant ID");
  });

  it("rejects a token whose issuer is another tenant than its tid claim", async () => {
    tokenEndpoint({ id_token: await idToken({}, { iss: `https://login.microsoftonline.com/${OTHER_TID}/v2.0` }) });
    await expect(exchangeCode("c", "v", "nonce-1")).rejects.toThrow(/"iss" claim/);
  });

  it("rejects a token issued for a different audience (another app)", async () => {
    tokenEndpoint({ id_token: await idToken({}, { aud: "someone-elses-app" }) });
    await expect(exchangeCode("c", "v", "nonce-1")).rejects.toThrow(/"aud" claim/);
  });

  it("rejects a nonce mismatch (replayed token)", async () => {
    tokenEndpoint({ id_token: await idToken({ nonce: "old" }) });
    await expect(exchangeCode("c", "v", "nonce-1")).rejects.toThrow("Nonce mismatch");
  });

  it("rejects a token signed by a key that is not in Microsoft's key set", async () => {
    tokenEndpoint({ id_token: await idToken({}, { key: otherPriv }) });
    await expect(exchangeCode("c", "v", "nonce-1")).rejects.toThrow();
  });

  it("rejects an expired token", async () => {
    tokenEndpoint({ id_token: await idToken({}, { exp: Math.floor(Date.now() / 1000) - 3600 }) });
    await expect(exchangeCode("c", "v", "nonce-1")).rejects.toThrow(/exp/i);
  });

  it("rejects a token with no object id or no email", async () => {
    tokenEndpoint({ id_token: await idToken({ oid: undefined }) });
    await expect(exchangeCode("c", "v", "nonce-1")).rejects.toThrow(/object ID or email/);
    tokenEndpoint({ id_token: await idToken({ preferred_username: undefined, email: undefined }) });
    await expect(exchangeCode("c", "v", "nonce-1")).rejects.toThrow(/object ID or email/);
  });

  it("uses the organizations endpoint when multi-tenant", async () => {
    vi.stubEnv("AUTH_ENTRA_MULTITENANT", "true");
    tokenEndpoint({ id_token: await idToken() });
    await exchangeCode("c", "v", "nonce-1");
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("https://login.microsoftonline.com/organizations/oauth2/v2.0/token");
  });
});

describe("resolveUser", () => {
  const id: EntraIdentity = { tid: TID, oid: "oid-1", email: "lily@prd.net.au", name: "Lily" };
  const companyTenant = { tid: TID, kind: "company", company_id: "prd", domains: ["prd.net.au"] };
  const platformTenant = { tid: TID, kind: "platform", company_id: null, domains: ["remap.ai"] };
  const user = { email: "lily@prd.net.au", role: "branch_admin", company_id: "prd", entra_oid: null, status: "active" };

  const setup = (o: { tenant?: unknown; bound?: unknown[]; byEmail?: unknown[] }) =>
    routeDb([
      [/from tenants/, o.tenant ? [o.tenant] : []],
      [/where entra_oid = /, o.bound ?? []],
      [/lower\(email\) = \$1/, o.byEmail ?? []],
    ]);

  it("rejects an unmapped tenant", async () => {
    setup({});
    expect(await resolveUser(id)).toEqual({ error: "Your organisation is not set up for this dashboard." });
  });

  it("rejects an email domain the tenant does not own", async () => {
    setup({ tenant: companyTenant, byEmail: [user] });
    expect(await resolveUser({ ...id, email: "lily@evil.test" })).toEqual({ error: "Your email domain is not registered for this organisation." });
  });

  it("rejects an unknown user in a known tenant and domain", async () => {
    setup({ tenant: companyTenant });
    expect(await resolveUser(id)).toMatchObject({ error: expect.stringContaining("not set up") });
  });

  it("binds the object id on first sign-in", async () => {
    setup({ tenant: companyTenant, byEmail: [user] });
    expect(await resolveUser(id)).toEqual({ email: "lily@prd.net.au" });
    const [, params] = callsMatching(/update users set entra_oid/)[0];
    expect(params).toEqual(["oid-1", "lily@prd.net.au"]);
  });

  it("does not rebind when already bound to the same account", async () => {
    setup({ tenant: companyTenant, bound: [{ ...user, entra_oid: "oid-1" }] });
    expect(await resolveUser(id)).toEqual({ email: "lily@prd.net.au" });
    expect(callsMatching(/update users/)).toHaveLength(0);
  });

  it("rejects a different Microsoft account claiming an already linked email", async () => {
    setup({ tenant: companyTenant, byEmail: [{ ...user, entra_oid: "someone-else" }] });
    expect(await resolveUser(id)).toEqual({ error: "This email is already linked to a different Microsoft account." });
    expect(callsMatching(/update users/)).toHaveLength(0);
  });

  it("rejects a deactivated user", async () => {
    setup({ tenant: companyTenant, byEmail: [{ ...user, status: "deactivated" }] });
    expect(await resolveUser(id)).toEqual({ error: "This account is deactivated." });
  });

  it("platform tenant only admits platform admins", async () => {
    const pid = { ...id, email: "hamza@remap.ai" };
    setup({ tenant: platformTenant, byEmail: [{ ...user, email: "hamza@remap.ai", role: "platform_admin", company_id: null }] });
    expect(await resolveUser(pid)).toEqual({ email: "hamza@remap.ai" });
    setup({ tenant: platformTenant, byEmail: [{ ...user, email: "hamza@remap.ai", role: "branch_admin" }] });
    expect(await resolveUser(pid)).toEqual({ error: "This account does not belong to your organisation." });
  });

  it("company tenant admits only that company's non-platform users", async () => {
    setup({ tenant: companyTenant, byEmail: [{ ...user, company_id: "other" }] });
    expect(await resolveUser(id)).toEqual({ error: "This account does not belong to your organisation." });
    setup({ tenant: companyTenant, byEmail: [{ ...user, role: "platform_admin", company_id: "prd" }] });
    expect(await resolveUser(id)).toEqual({ error: "This account does not belong to your organisation." });
  });

  it("a bound oid skips the domain check but still enforces tenant ownership", async () => {
    setup({ tenant: companyTenant, bound: [{ ...user, entra_oid: "oid-1", company_id: "other" }] });
    expect(await resolveUser({ ...id, email: "x@elsewhere.test" })).toEqual({ error: "This account does not belong to your organisation." });
    expect(query).toHaveBeenCalled();
  });
});
