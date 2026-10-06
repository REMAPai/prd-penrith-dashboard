import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { query } from "./db";
import type { Role } from "./roles";

const COOKIE = "prd_session";
const MAX_AGE = 60 * 60 * 8;

export type Session = {
  email: string;
  name: string;
  role: Role;
  companyId: string | null;
  branchId: string | null;
};

const key = () => {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set (32+ chars)");
  return new TextEncoder().encode(s);
};

export async function createSession(s: Session) {
  const token = await new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

type UserRow = { email: string; name: string; role: Role; company_id: string | null; branch_id: string | null; status: string };

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    const email = String(payload.email);
    const rows = await query<UserRow>("select email, name, role, company_id, branch_id, status from users where email = $1", [email]);
    const u = rows[0];
    if (!u || u.status !== "active") return null;
    return { email: u.email, name: u.name, role: u.role, companyId: u.company_id, branchId: u.branch_id };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

export async function audit(actor: string | null, action: string, detail: string, companyId: string | null = null, branchId: string | null = null) {
  await query("insert into audit_log (actor_email, action, detail, company_id, branch_id) values ($1,$2,$3,$4,$5)", [actor, action, detail, companyId, branchId]);
}

export async function signInUser(email: string, method: string): Promise<Session | null> {
  const rows = await query<UserRow>("select email, name, role, company_id, branch_id, status from users where lower(email) = lower($1)", [email]);
  const u = rows[0];
  if (!u || u.status !== "active") return null;
  await query("update users set last_login = now() where email = $1", [u.email]);
  const s: Session = { email: u.email, name: u.name, role: u.role, companyId: u.company_id, branchId: u.branch_id };
  await createSession(s);
  await audit(u.email, "Sign-in", `Signed in via ${method}`, u.company_id, u.branch_id);
  return s;
}
