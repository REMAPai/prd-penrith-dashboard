import { access } from "@/lib/ctx";
import { Card, Denied, Kpi, Notice, PageHeader } from "@/components/ui";

// Figures below come from the Business Analysis report (2 Oct 2026). Per-project unit splits are not published yet.
const PROJECTS = ["Perle", "Havenwood Estate", "Rodley Square", "Sky Gardens", "Eden", "75 Great Western Highway"];

export default async function Projects() {
  const ctx = await access("projects");
  if (!ctx) return null;
  if (ctx === "denied") return <Denied />;
  return (
    <>
      <PageHeader title="Projects and Stock" status="prototype" sub="Off-the-plan projects. Headline figures are from the Business Analysis; per-project detail needs the projects stock sheet." />
      <Notice>The six projects and the headline totals come from the Business Analysis report dated 2 Oct 2026. They are not yet synced from the stock sheet, so treat them as a snapshot.</Notice>
      <div className="grid-kpi">
        <Kpi label="Units across projects" value="65" status="prototype" />
        <Kpi label="Available stock" value="$46.6m" status="prototype" />
        <Kpi label="Units sold" value="1" status="prototype" />
        <Kpi label="Projects" value={PROJECTS.length} status="prototype" />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        <Card status="prototype" title="Projects" basis="320px" sub="Unit split and enquiries per project: waiting on stock sheet access.">
          <table className="t"><tbody>{PROJECTS.map((p) => <tr key={p}><td style={{ fontWeight: 500 }}>{p}</td><td className="soft">Waiting on stock sheet</td></tr>)}</tbody></table>
        </Card>
      </div>
    </>
  );
}
