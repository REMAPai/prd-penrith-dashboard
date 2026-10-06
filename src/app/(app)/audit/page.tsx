import { access } from "@/lib/ctx";
import { query } from "@/lib/db";
import { Card, Denied, PageHeader, fmtDate } from "@/components/ui";

type Row = { at: string; actor_email: string | null; action: string; detail: string | null };

export default async function AuditPage() {
  const ctx = await access("audit");
  if (!ctx) return null;
  if (ctx === "denied") return <Denied />;
  const { role, companyId } = ctx.session;
  const rows = role === "platform_admin"
    ? await query<Row>("select at, actor_email, action, detail from audit_log order by at desc limit 200")
    : await query<Row>("select at, actor_email, action, detail from audit_log where company_id = $1 and ($2::text is null or branch_id = $2) order by at desc limit 200", [companyId, role === "company_admin" ? null : ctx.session.branchId]);
  return (
    <>
      <PageHeader title="Audit Log" status="live" sub="Sign-ins, role changes, contact reveals, stage moves and settings. Append-only." />
      <Card title="Latest 200 events" source="Postgres audit table">
        <div style={{ overflow: "auto" }}>
          <table className="t" style={{ minWidth: 640 }}>
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Detail</th></tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i}><td className="soft" style={{ whiteSpace: "nowrap" }}>{fmtDate(r.at)}</td><td>{r.actor_email}</td><td style={{ fontWeight: 500 }}>{r.action}</td><td className="soft">{r.detail}</td></tr>)}</tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
