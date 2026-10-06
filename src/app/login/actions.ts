"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { query } from "@/lib/db";
import { audit, destroySession, signInUser, getSession } from "@/lib/session";

const attempts = new Map<string, { n: number; at: number }>();
const WINDOW = 10 * 60 * 1000;

const Schema = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) });

export async function passwordLogin(_prev: { error?: string } | undefined, form: FormData): Promise<{ error?: string }> {
  if (process.env.AUTH_FALLBACK_ENABLED === "false") return { error: "Password sign-in is turned off. Use Microsoft." };
  const parsed = Schema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Enter your email and password." };
  const email = parsed.data.email.toLowerCase();

  const a = attempts.get(email);
  if (a && Date.now() - a.at < WINDOW && a.n >= 5) return { error: "Too many attempts. Try again in a few minutes." };

  const rows = await query<{ password_hash: string | null; status: string }>("select password_hash, status from users where lower(email) = $1", [email]);
  const u = rows[0];
  const ok = !!u && u.status === "active" && !!u.password_hash && (await bcrypt.compare(parsed.data.password, u.password_hash));
  if (!ok) {
    attempts.set(email, { n: (a && Date.now() - a.at < WINDOW ? a.n : 0) + 1, at: Date.now() });
    await audit(email, "Sign-in failed", "Wrong email or password");
    return { error: "Wrong email or password." };
  }
  attempts.delete(email);
  const s = await signInUser(email, "password");
  redirect(s?.role === "platform_admin" ? "/companies" : "/progress");
}

export async function signOut() {
  const s = await getSession();
  if (s) await audit(s.email, "Sign-out", "Signed out", s.companyId, s.branchId);
  await destroySession();
  redirect("/login");
}
