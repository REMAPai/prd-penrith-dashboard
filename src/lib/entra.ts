import "server-only";
import { createRemoteJWKSet, decodeJwt, jwtVerify } from "jose";
import { query } from "./db";
import type { Role } from "./roles";

export const entraEnabled = () =>
  process.env.AUTH_ENTRA_ENABLED === "true" &&
  !!process.env.AUTH_ENTRA_CLIENT_ID &&
  !!process.env.AUTH_ENTRA_CLIENT_SECRET &&
  (isMultiTenant() || !!process.env.AUTH_ENTRA_TENANT_ID);

// Multi-tenant needs the app registration set to "any organizational directory" first.
export const isMultiTenant = () => process.env.AUTH_ENTRA_MULTITENANT === "true";
const authority = () => (isMultiTenant() ? "organizations" : process.env.AUTH_ENTRA_TENANT_ID!);
export const redirectUri = () => `${(process.env.AUTH_URL || "http://localhost:3000").replace(/\/$/, "")}/api/auth/entra/callback`;

const b64url = (buf: ArrayBuffer | Uint8Array) => Buffer.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).toString("base64url");

export function randomToken(n = 32) {
  return b64url(crypto.getRandomValues(new Uint8Array(n)));
}

export async function challengeFor(verifier: string) {
  return b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
}

export function authorizeUrl(state: string, nonce: string, challenge: string) {
  const p = new URLSearchParams({
    client_id: process.env.AUTH_ENTRA_CLIENT_ID!,
    response_type: "code",
    redirect_uri: redirectUri(),
    response_mode: "query",
    scope: "openid profile email",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `https://login.microsoftonline.com/${authority()}/oauth2/v2.0/authorize?${p}`;
}

export type EntraIdentity = { tid: string; oid: string; email: string; name: string };

export async function exchangeCode(code: string, verifier: string, nonce: string): Promise<EntraIdentity> {
  const res = await fetch(`https://login.microsoftonline.com/${authority()}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_ENTRA_CLIENT_ID!,
      client_secret: process.env.AUTH_ENTRA_CLIENT_SECRET!,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.id_token) throw new Error(json.error_description?.split("\r")[0] || "Token exchange failed");

  // The issuer contains the signer's tenant ID, so read it first, then verify the signature and that exact issuer.
  const tid = String(decodeJwt(json.id_token).tid || "");
  if (!/^[0-9a-f-]{36}$/i.test(tid)) throw new Error("Token has no tenant ID");
  const jwks = createRemoteJWKSet(new URL("https://login.microsoftonline.com/common/discovery/v2.0/keys"));
  const { payload } = await jwtVerify(json.id_token, jwks, { issuer: `https://login.microsoftonline.com/${tid}/v2.0`, audience: process.env.AUTH_ENTRA_CLIENT_ID! });
  if (payload.nonce !== nonce) throw new Error("Nonce mismatch");
  const oid = String(payload.oid || "");
  const email = String(payload.preferred_username || payload.email || "").toLowerCase();
  if (!oid || !email) throw new Error("Microsoft account is missing an object ID or email");
  return { tid, oid, email, name: String(payload.name || email) };
}

type Tenant = { tid: string; kind: "platform" | "company"; company_id: string | null; domains: string[] };
type UserRow = { email: string; role: Role; company_id: string | null; entra_oid: string | null; status: string };

/** Returns the app user this Microsoft identity may act as, or a reason it may not. Binds the object ID on first use. */
export async function resolveUser(id: EntraIdentity): Promise<{ email: string } | { error: string }> {
  const tenants = await query<Tenant>("select tid, kind, company_id, domains from tenants where tid = $1", [id.tid]);
  const tenant = tenants[0];
  if (!tenant) return { error: "Your organisation is not set up for this dashboard." };

  const bound = await query<UserRow>("select email, role, company_id, entra_oid, status from users where entra_oid = $1", [id.oid]);
  let user = bound[0];
  if (!user) {
    const domain = id.email.split("@")[1];
    if (!tenant.domains.includes(domain)) return { error: "Your email domain is not registered for this organisation." };
    const byEmail = await query<UserRow>("select email, role, company_id, entra_oid, status from users where lower(email) = $1", [id.email]);
    user = byEmail[0];
    if (!user) return { error: "Your account is not set up for this dashboard. Ask your admin to add you." };
    if (user.entra_oid && user.entra_oid !== id.oid) return { error: "This email is already linked to a different Microsoft account." };
  }
  if (user.status !== "active") return { error: "This account is deactivated." };
  const allowed = tenant.kind === "platform" ? user.role === "platform_admin" : user.company_id === tenant.company_id && user.role !== "platform_admin";
  if (!allowed) return { error: "This account does not belong to your organisation." };
  if (!user.entra_oid) await query("update users set entra_oid = $1 where lower(email) = lower($2)", [id.oid, user.email]);
  return { email: user.email };
}
