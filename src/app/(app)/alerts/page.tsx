import { access } from "@/lib/ctx";
import { getConversations, qualityFlags } from "@/lib/data/conversations";
import { sampleAlerts } from "@/lib/data/sample";
import { checkSources } from "@/lib/health";
import { Badge, Card, Denied, Notice, PageHeader } from "@/components/ui";

const sev = (s: string) => (s === "high" ? "red" : s === "med" ? "prototype" : "grey");

export default async function Alerts() {
  const ctx = await access("alerts");
  if (!ctx) return null;
  if (ctx === "denied") return <Denied />;
  const [health, convos] = await Promise.all([checkSources(), getConversations(ctx.branch.id)]);
  const down = health.filter((h) => h.status === "waiting");
  const flags = qualityFlags(convos.data);
  const real = [
    ...down.map((h) => ({ key: h.name, severity: "med", source: h.name, message: `${h.detail}${h.needs ? `. Needs: ${h.needs}` : ""}` })),
    ...(flags.length ? [{ key: "q", severity: "low", source: "Quality", message: `${flags.length} conversation quality flags (see Buyer Sequencing, Quality tab)` }] : []),
  ];
  return (
    <>
      <PageHeader title="Alerts and Logs" status="prototype" sub="Connection problems and conversation quality flags, computed now. A delivery channel (Teams or email) is still to be chosen." />
      <Notice>Failure alerts are not yet delivered to Teams or email. Darren to confirm the destination.</Notice>
      <Card title="Active alerts" sub="From live checks" source="Computed from live connection checks and the conversation log">
        <table className="t"><tbody>
          {real.length === 0 && <tr><td className="soft">Nothing to report.</td></tr>}
          {real.map((a) => <tr key={a.key}><td><Badge tone={sev(a.severity)}>{a.severity}</Badge></td><td style={{ fontWeight: 500 }}>{a.source}</td><td className="soft">{a.message}</td></tr>)}
        </tbody></table>
      </Card>
      <Card status="sample" title="What the alert feed will look like once failure alerts are wired">
        <table className="t"><tbody>
          {sampleAlerts().map((a) => <tr key={a.key}><td><Badge tone={sev(a.severity)}>{a.severity}</Badge></td><td style={{ fontWeight: 500 }}>{a.source}</td><td className="soft">{a.message}</td><td className="soft">{a.age}</td></tr>)}
        </tbody></table>
      </Card>
    </>
  );
}
