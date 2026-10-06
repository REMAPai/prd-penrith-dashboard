import { revalidatePath } from "next/cache";
import { z } from "zod";
import { access } from "@/lib/ctx";
import { query } from "@/lib/db";
import { audit } from "@/lib/session";
import { Badge, Card, Denied, PageHeader, fmtDate } from "@/components/ui";
import { ROLE_LABEL, type Role } from "@/lib/roles";

// Which roles an actor may grant. Never above their own level.
const GRANTABLE: Record<string, Role[]> = {
  platform_admin: ["platform_admin", "company_admin", "branch_admin", "marketing", "agent", "viewer"],
  company_admin: ["branch_admin", "marketing", "agent", "viewer"],
  branch_admin: ["marketing", "agent", "viewer"],
};

type U = { email: string; name: string; role: Role; company_id: string | null; branch_id: string | null; status: string; last_login: string | null };

async function addUser(formData: FormData) {
  "use server";
  const ctx = await access("users");
  if (!ctx || ctx === "denied") return;
  const p = z.object({ email: z.string().email().max(200), name: z.string().min(2).max(100), role: z.string(), branch: z.string().max(20) }).safeParse(Object.fromEntries(formData));
  if (!p.success) return;
  const allowed = GRANTABLE[ctx.session.role] ?? [];
  if (!allowed.includes(p.data.role as Role)) return;
  const branch = ctx.branches.find((b) => b.id === p.data.branch);
  if (!branch && p.data.role !== "platform_admin") return;
  const company = p.data.role === "platform_admin" ? null : branch!.company_id;
  await query(
    `insert into users (email, name, role, company_id, branch_id) values (lower($1),$2,$3,$4,$5)
     on conflict (email) do nothing`,
    [p.data.email, p.data.name, p.data.role, company, p.data.role === "platform_admin" || p.data.role === "company_admin" ? null : branch?.id ?? null],
  );
  await audit(ctx.session.email, "User added", `${p.data.email} as ${ROLE_LABEL[p.data.role as Role]}`, ctx.branch.company_id, ctx.branch.id);
  revalidatePath("/users");
}

async function toggleUser(formData: FormData) {
  "use server";
  const ctx = await access("users");
  if (!ctx || ctx === "denied") return;
  const email = String(formData.get("email")).toLowerCase();
  if (email === ctx.session.email.toLowerCase()) return; // cannot lock yourself out
  const rows = await query<{ role: Role; company_id: string | null; branch_id: string | null; status: string }>("select role, company_id, branch_id, status from users where lower(email) = $1", [email]);
  const t = rows[0];
  if (!t) return;
  const actor = ctx.session;
  const inScope = actor.role === "platform_admin" || (actor.role === "company_admin" && t.company_id === actor.companyId) || (actor.role === "branch_admin" && t.branch_id === actor.branchId);
  if (!inScope || !(GRANTABLE[actor.role] ?? []).includes(t.role)) return;
  const next = t.status === "active" ? "deactivated" : "active";
  await query("update users set status = $1 where lower(email) = $2", [next, email]);
  await audit(actor.email, "User status", `${email} set to ${next}`, ctx.branch.company_id, ctx.branch.id);
  revalidatePath("/users");
}

export default async function Users() {
  const ctx = await access("users");
  if (!ctx) return null;
  if (ctx === "denied") return <Denied />;
  const { role, companyId, branchId } = ctx.session;
  const users = role === "platform_admin"
    ? await query<U>("select email, name, role, company_id, branch_id, status, last_login from users order by role, name")
    : role === "company_admin"
      ? await query<U>("select email, name, role, company_id, branch_id, status, last_login from users where company_id = $1 order by role, name", [companyId])
      : await query<U>("select email, name, role, company_id, branch_id, status, last_login from users where branch_id = $1 order by role, name", [branchId]);
  const grant = GRANTABLE[role] ?? [];
  const mine = (u: U) => u.email.toLowerCase() === ctx.session.email.toLowerCase() || !grant.includes(u.role);

  return (
    <>
      <PageHeader title="Users and Roles" status="live" sub="People with access. Users must also be added here before Microsoft sign-in will let them in." />
      <Card title="Add a user" basis="100%">
        <form action={addUser} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 200px" }}><div className="soft" style={{ fontSize: 11 }}>Work email</div><input name="email" type="email" required /></div>
          <div style={{ flex: "1 1 160px" }}><div className="soft" style={{ fontSize: 11 }}>Name</div><input name="name" required /></div>
          <div style={{ flex: "1 1 140px" }}><div className="soft" style={{ fontSize: 11 }}>Role</div><select name="role">{grant.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></div>
          <div style={{ flex: "1 1 140px" }}><div className="soft" style={{ fontSize: 11 }}>Branch</div><select name="branch" defaultValue={ctx.branch.id}>{ctx.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
          <button className="btn primary">Add</button>
        </form>
      </Card>
      <Card title="People" source="Postgres users table">
        <div style={{ overflow: "auto" }}>
          <table className="t" style={{ minWidth: 640 }}>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last sign-in</th><th>Status</th><th /></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.email}>
                  <td style={{ fontWeight: 500 }}>{u.name}</td><td className="soft">{u.email}</td><td>{ROLE_LABEL[u.role]}</td><td className="soft">{u.last_login ? fmtDate(u.last_login) : "Never"}</td>
                  <td><Badge tone={u.status === "active" ? "done" : "grey"}>{u.status}</Badge></td>
                  <td>{!mine(u) && <form action={toggleUser}><input type="hidden" name="email" value={u.email} /><button className="btn sm">{u.status === "active" ? "Deactivate" : "Reactivate"}</button></form>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
