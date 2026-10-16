import type { Branch, Ctx } from "@/lib/ctx";
import type { Role } from "@/lib/roles";
import type { Session } from "@/lib/session";

export const ROLES: Role[] = ["platform_admin", "company_admin", "branch_admin", "marketing", "agent", "viewer"];

export const BRANCHES: Branch[] = [
  { id: "pen", company_id: "prd", name: "Penrith", suburbs: ["Penrith", "St Marys"] },
  { id: "bm", company_id: "prd", name: "Blue Mountains", suburbs: ["Katoomba"] },
  { id: "gp", company_id: "prd", name: "Glenmore Park", suburbs: ["Glenmore Park"] },
  { id: "oth", company_id: "other", name: "Other Branch", suburbs: ["Elsewhere"] },
];

export function makeSession(role: Role, over: Partial<Session> = {}): Session {
  const global = role === "platform_admin";
  return {
    email: `${role}@test.example`,
    name: `Test ${role}`,
    role,
    companyId: global ? null : "prd",
    branchId: global || role === "company_admin" ? null : "pen",
    ...over,
  };
}

export function allowedBranches(s: Session): Branch[] {
  if (s.role === "platform_admin") return BRANCHES;
  if (s.role === "company_admin") return BRANCHES.filter((b) => b.company_id === s.companyId);
  return BRANCHES.filter((b) => b.id === s.branchId);
}

export function makeCtx(role: Role, over: Partial<Ctx> = {}, sessionOver: Partial<Session> = {}): Ctx {
  const session = makeSession(role, sessionOver);
  const branches = allowedBranches(session);
  return { session, branch: branches.find((b) => b.id === "pen") ?? branches[0], branches, liveOnly: false, companyName: "PRD Group", ...over };
}

export const form = (o: Record<string, string | number>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) fd.set(k, String(v));
  return fd;
};
