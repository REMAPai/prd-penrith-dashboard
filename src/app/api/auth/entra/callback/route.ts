import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode } from "@/lib/entra";
import { audit, signInUser } from "@/lib/session";

const base = () => process.env.AUTH_URL || "http://localhost:3000";
const fail = (msg: string) => NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(msg)}`, base()));

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const raw = req.cookies.get("prd_oidc")?.value;
  const code = url.searchParams.get("code");
  if (url.searchParams.get("error")) return fail(url.searchParams.get("error_description")?.split("\r")[0] || "Microsoft sign-in was cancelled");
  if (!raw || !code) return fail("Sign-in session expired. Try again.");
  const { state, nonce, verifier } = JSON.parse(raw) as { state: string; nonce: string; verifier: string };
  if (state !== url.searchParams.get("state")) return fail("Sign-in state did not match. Try again.");

  try {
    const { email } = await exchangeCode(code, verifier, nonce);
    const s = await signInUser(email, "Microsoft Entra");
    if (!s) {
      await audit(email, "Sign-in denied", "Microsoft account has no active user in this app");
      return fail("Your Microsoft account is not set up for this dashboard. Ask your admin to add you.");
    }
    const res = NextResponse.redirect(new URL(s.role === "platform_admin" ? "/companies" : "/progress", base()));
    res.cookies.delete({ name: "prd_oidc", path: "/api/auth/entra" });
    return res;
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Microsoft sign-in failed");
  }
}
