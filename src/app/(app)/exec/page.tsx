import { nowMs } from "@/lib/time";
import { access } from "@/lib/ctx";
import { query } from "@/lib/db";
import { getConversations } from "@/lib/data/conversations";
import { Bars, Card, Cols, Denied, Kpi, PageHeader } from "@/components/ui";
import { STAGES } from "@/lib/stages";

export default async function Exec() {
  const ctx = await access("exec");
  if (!ctx) return null;
  if (ctx === "denied") return <Denied />;
  const convos = await getConversations(ctx.branch.id);
  const st = convos.status;
  const rows = convos.data;
  const wk = rows.filter((c) => nowMs() - new Date(c.startedAt).getTime() < 7 * 86400000);
  const sites = await query<{ stage: number; is_sample: boolean }>("select stage, is_sample from pipeline_sites where branch_id = $1 and is_sample = false", [ctx.branch.id]);
  const realSites = sites.filter((s) => !s.is_sample);

  const bySuburb: Record<string, number> = {};
  for (const c of rows) {
    const sub = c.property.split(",").pop()?.trim() || "Unknown";
    bySuburb[sub] = (bySuburb[sub] || 0) + 1;
  }
  const top = Object.entries(bySuburb).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value }));
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const from = nowMs() - (8 - i) * 7 * 86400000;
    return { label: `W${i + 1}`, value: rows.filter((c) => { const t = new Date(c.startedAt).getTime(); return t >= from && t < from + 7 * 86400000; }).length };
  });
  const funnel = STAGES.map((label, i) => ({ label, value: sites.filter((s) => s.stage === i).length }));

  return (
    <>
      <PageHeader title="Executive Overview" status="prototype" sub="Every number carries its data status. Money figures appear once a finance feed is connected." />
      <div className="grid-kpi">
        <Kpi label="Enquiries (7 days)" value={wk.length} status={st} />
        <Kpi label="Ready for an agent" value={rows.filter((c) => c.readyForAgent).length} status={st} />
        <Kpi label="Hot buyers" value={rows.filter((c) => c.temperature === "Hot").length} status={st} />
        <Kpi label="Real DAs tracked" value={realSites.length} />
        <Kpi label="Project stock available" value="65 units" status="prototype" />
        <Kpi label="Meta leads vs target" value="45 / 100 wk" status="prototype" />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        <Card status={st} title="Enquiries, last 8 weeks" basis="380px" source={convos.source}><Cols items={weeks} /></Card>
        <Card status={st} title="Top suburbs by demand" basis="380px" source={convos.source}><Bars items={top} /></Card>
        <Card title="Pipeline by stage" sub="Real DAs from the tracker" basis="380px" source="Postgres pipeline table"><Bars items={funnel} /></Card>
      </div>
    </>
  );
}
