import { access } from "@/lib/ctx";
import { checkSources } from "@/lib/health";
import { Card, Denied, PageHeader, StatusBadge } from "@/components/ui";

export default async function Sources() {
  const ctx = await access("sources");
  if (!ctx) return null;
  if (ctx === "denied") return <Denied />;
  const rows = await checkSources();
  return (
    <>
      <PageHeader title="Data Sources" status="live" sub="Every connection, whether it is working, and what it needs to go live." />
      <Card title="Connections" source="Checked just now (read-only calls)">
        <div style={{ overflow: "auto" }}>
          <table className="t" style={{ minWidth: 720 }}>
            <thead><tr><th>Source</th><th>Status</th><th>Detail</th><th>Owner</th><th>Needed to go live</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <td style={{ fontWeight: 500 }}>{r.name}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="soft">{r.detail}</td><td>{r.owner}</td><td className="soft">{r.needs ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
