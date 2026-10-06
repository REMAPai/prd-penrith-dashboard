import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { query } from "./db";
import { canSee, pageByKey, type Role } from "./roles";
import { getSession, type Session } from "./session";

export type Branch = { id: string; name: string; company_id: string; suburbs: string[] };
export type Ctx = { session: Session; branch: Branch; branches: Branch[]; liveOnly: boolean; companyName: string };

export const getCtx = cache(async (): Promise<Ctx | null> => {
  const session = await getSession();
  if (!session) return null;
  const jar = await cookies();
  const all = await query<Branch>("select id, company_id, name, suburbs from branches order by name");
  const allowed = session.role === "platform_admin" ? all : session.role === "company_admin" ? all.filter((b) => b.company_id === session.companyId) : all.filter((b) => b.id === session.branchId);
  const wanted = jar.get("scope")?.value;
  const branch = allowed.find((b) => b.id === wanted) || allowed.find((b) => b.id === "pen") || allowed[0];
  const co = await query<{ name: string }>("select name from companies where id = $1", [branch?.company_id ?? "prd"]);
  return { session, branch, branches: allowed, liveOnly: jar.get("liveOnly")?.value === "1", companyName: co[0]?.name ?? "PRD Group" };
});

export async function access(key: string): Promise<Ctx | "denied" | null> {
  const ctx = await getCtx();
  if (!ctx) return null;
  return canSee(ctx.session.role as Role, pageByKey(key)) ? ctx : "denied";
}
