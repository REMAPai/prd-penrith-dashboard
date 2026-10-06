import { NextResponse } from "next/server";
import { authorizeUrl, challengeFor, entraEnabled, randomToken } from "@/lib/entra";

export async function GET() {
  if (!entraEnabled()) return NextResponse.redirect(new URL("/login?error=Microsoft+sign-in+is+not+enabled", process.env.AUTH_URL || "http://localhost:3000"));
  const state = randomToken();
  const nonce = randomToken();
  const verifier = randomToken(48);
  const res = NextResponse.redirect(authorizeUrl(state, nonce, await challengeFor(verifier)));
  res.cookies.set("prd_oidc", JSON.stringify({ state, nonce, verifier }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/entra",
    maxAge: 600,
  });
  return res;
}
