import { access } from "@/lib/ctx";
import { sampleMeta } from "@/lib/data/sample";
import { Card, Cols, Denied, Kpi, Notice, PageHeader } from "@/components/ui";

export default async function Meta() {
  const ctx = await access("meta");
  if (!ctx) return null;
  if (ctx === "denied") return <Denied />;
  const weeks = sampleMeta(ctx.branch.id);
  return (
    <>
      <PageHeader title="Meta Lead Funnel" status="sample" sub="Facebook and Instagram project leads, from ad to Vault." />
      <Notice>Weekly figures are sample until Thomas shares read access to the Meta leads sheet. The two real reference points are shown first. Today, campaign leads reach Vault only after a manual step (Thomas calls, then Thea adds them).</Notice>
      <div className="grid-kpi">
        <Kpi label="Leads in the last 10 days" value="45" status="prototype" />
        <Kpi label="Weekly target" value="100" status="prototype" />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        <Card status="sample" title="Leads per week" basis="380px"><Cols items={weeks.map((w) => ({ label: w.week, value: w.leads }))} /></Card>
        <Card status="sample" title="Speed and drop-off" basis="420px">
          <table className="t"><thead><tr><th>Week</th><th>Leads</th><th>Hours to first contact</th><th>In Vault</th><th>Drop-off %</th></tr></thead>
            <tbody>{weeks.map((w) => <tr key={w.week}><td>{w.week}</td><td>{w.leads}</td><td>{w.hoursToFirst}</td><td>{w.inVault}</td><td>{w.dropPct}</td></tr>)}</tbody></table>
        </Card>
      </div>
    </>
  );
}
