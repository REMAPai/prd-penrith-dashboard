import { access } from "@/lib/ctx";
import { query } from "@/lib/db";
import { Badge, Card, Denied, PageHeader } from "@/components/ui";

export default async function Companies() {
  const ctx = await access("companies");
  if (!ctx) return null;
  if (ctx === "denied") return <Denied />;
  const rows = await query<{ company: string; entra: boolean; branch: string; suburbs: string[]; users: string }>(
    `select c.name as company, c.entra_enabled as entra, b.name as branch, b.suburbs, (select count(*) from users u where u.branch_id = b.id) as users
     from branches b join companies c on c.id = b.company_id order by c.name, b.name`,
  );
  const tenants = await query<{ tid: string; name: string; kind: string; domains: string[]; users: string }>(
    `select t.tid, t.name, t.kind, t.domains, (select count(*) from users u where u.entra_oid is not null and (t.kind = 'platform' and u.role = 'platform_admin' or t.kind = 'company' and u.company_id = t.company_id)) as users from tenants t order by t.kind, t.name`,
  );
  return (
    <>
      <PageHeader title="Companies and Branches" status="live" sub="Each company and branch has its own admin, users and data. Platform admins only." />
      <Card title="Branches">
        <table className="t"><thead><tr><th>Company</th><th>Branch</th><th>Suburbs</th><th>Users</th><th>Microsoft sign-in</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.company + r.branch}><td style={{ fontWeight: 500 }}>{r.company}</td><td>{r.branch}</td><td className="soft">{r.suburbs.join(", ")}</td><td>{r.users}</td><td><Badge tone={r.entra ? "done" : "grey"}>{r.entra ? "On" : "Off"}</Badge></td></tr>)}</tbody></table>
      </Card>
      <Card title="Microsoft tenants" sub="Which Microsoft organisations may sign in, and for which email domains. Users are bound to their Microsoft account on first sign-in.">
        <table className="t"><thead><tr><th>Organisation</th><th>Type</th><th>Email domains</th><th>Linked users</th><th>Tenant ID</th></tr></thead>
          <tbody>{tenants.map((t) => <tr key={t.tid}><td style={{ fontWeight: 500 }}>{t.name}</td><td>{t.kind === "platform" ? "Platform (REMAP)" : "Company"}</td><td>{t.domains.join(", ")}</td><td>{t.users}</td><td className="soft" style={{ fontSize: 11 }}>{t.tid}</td></tr>)}</tbody></table>
      </Card>
    </>
  );
}
