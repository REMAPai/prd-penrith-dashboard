import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";

export const entraEnabled = () =>
  process.env.AUTH_ENTRA_ENABLED === "true" &&
  !!process.env.AUTH_ENTRA_TENANT_ID &&
  !!process.env.AUTH_ENTRA_CLIENT_ID &&
  !!process.env.AUTH_ENTRA_CLIENT_SECRET;

const tenant = () => process.env.AUTH_ENTRA_TENANT_ID!;
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
  return `https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/authorize?${p}`;
}

export async function exchangeCode(code: string, verifier: string, nonce: string): Promise<{ email: string; name: string }> {
  const res = await fetch(`https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/token`, {
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
  const jwks = createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tenant()}/discovery/v2.0/keys`));
  const { payload } = await jwtVerify(json.id_token, jwks, {
    issuer: `https://login.microsoftonline.com/${tenant()}/v2.0`,
    audience: process.env.AUTH_ENTRA_CLIENT_ID!,
  });
  if (payload.nonce !== nonce) throw new Error("Nonce mismatch");
  const email = String(payload.preferred_username || payload.email || "").toLowerCase();
  if (!email) throw new Error("No email on the Microsoft account");
  return { email, name: String(payload.name || email) };
}
