import { nowMs } from "@/lib/time";
import { access } from "@/lib/ctx";
import { query } from "@/lib/db";
import { getConversations } from "@/lib/data/conversations";
import { getListings } from "@/lib/data/vault";
import { Badge, Card, Denied, Notice, PageHeader } from "@/components/ui";

const day = 86400000;

export default async function Market() {
  const ctx = await access("market");
  if (!ctx) return null;
  if (ctx === "denied") return <Denied />;
  const convos = await getConversations(ctx.branch.id);
  const listings = await getListings(ctx.branch.id, convos.data);
  const sites = await query<{ suburb: string; is_sample: boolean }>("select suburb, is_sample from pipeline_sites where branch_id = $1", [ctx.branch.id]);

  const suburbs = new Map<string, { recent: number; prior: number; hot: number; listings: number; sites: number }>();
  const get = (s: string) => suburbs.get(s) ?? suburbs.set(s, { recent: 0, prior: 0, hot: 0, listings: 0, sites: 0 }).get(s)!;
  for (const c of convos.data) {
    const sub = c.property.split(",").pop()?.trim().toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
    if (!sub) continue;
    const age = nowMs() - new Date(c.startedAt).getTime();
    const e = get(sub);
    if (age < 14 * day) e.recent++; else if (age < 28 * day) e.prior++;
    if (c.temperature === "Hot") e.hot++;
  }
  for (const l of listings.data) if (l.suburb) get(l.suburb).listings++;
  for (const s of sites.filter((x) => !x.is_sample)) get(s.suburb).sites++;

  const rows = [...suburbs.entries()].map(([name, v]) => ({ name, ...v, score: v.recent * 2 + v.hot * 3 + v.sites * 2 - v.listings * 0.5, trend: v.recent - v.prior })).sort((a, b) => b.score - a.score).slice(0, 12);
  const st = convos.status === "live" && listings.status === "live" ? "live" : "prototype";

  return (
    <>
      <PageHeader title="Market Insights" status={st === "live" ? "live" : "prototype"} sub="Where buyer demand is gaining or cooling, and where to focus." />
      <Notice>The focus score is a transparent rule, not a prediction: recent enquiries x2, hot buyers x3, tracked sites x2, minus half a point per current listing already supplying the suburb. Sites count real DAs only. {convos.status !== "live" ? "Demand needs the live conversation log to be connected." : ""}</Notice>
      <Card status={st} title="Suburbs ranked by focus score" sub="Enquiries compare the last 14 days with the 14 days before." source={`${convos.source}; ${listings.source}`}>
        <table className="t"><thead><tr><th>Suburb</th><th>Enquiries (14d)</th><th>Trend</th><th>Hot</th><th>Listings</th><th>Real DAs</th><th>Score</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td style={{ fontWeight: 500 }}>{r.name}</td><td>{r.recent}</td>
                <td>{r.trend > 0 ? <Badge tone="done">Gaining +{r.trend}</Badge> : r.trend < 0 ? <Badge tone="red">Cooling {r.trend}</Badge> : <Badge>Flat</Badge>}</td>
                <td>{r.hot}</td><td>{r.listings}</td><td>{r.sites}</td><td style={{ fontWeight: 600 }}>{r.score.toFixed(1)}</td>
              </tr>
            ))}
          </tbody></table>
      </Card>
    </>
  );
}
