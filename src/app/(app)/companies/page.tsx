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
  return (
    <>
      <PageHeader title="Companies and Branches" status="live" sub="Each company and branch has its own admin, users and data. Platform admins only." />
      <Card title="Branches">
        <table className="t"><thead><tr><th>Company</th><th>Branch</th><th>Suburbs</th><th>Users</th><th>Microsoft sign-in</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.company + r.branch}><td style={{ fontWeight: 500 }}>{r.company}</td><td>{r.branch}</td><td className="soft">{r.suburbs.join(", ")}</td><td>{r.users}</td><td><Badge tone={r.entra ? "done" : "grey"}>{r.entra ? "On" : "Off"}</Badge></td></tr>)}</tbody></table>
      </Card>
    </>
  );
}
