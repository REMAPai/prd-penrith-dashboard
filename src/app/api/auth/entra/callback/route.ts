import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode, resolveUser } from "@/lib/entra";
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
    const id = await exchangeCode(code, verifier, nonce);
    const who = await resolveUser(id);
    if ("error" in who) {
      await audit(id.email, "Sign-in denied", `${who.error} (tenant ${id.tid})`);
      return fail(who.error);
    }
    const s = await signInUser(who.email, "Microsoft Entra");
    if (!s) return fail("Your account is not active.");
    const res = NextResponse.redirect(new URL(s.role === "platform_admin" ? "/companies" : "/progress", base()));
    res.cookies.delete({ name: "prd_oidc", path: "/api/auth/entra" });
    return res;
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Microsoft sign-in failed");
  }
}
