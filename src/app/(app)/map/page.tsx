import { access } from "@/lib/ctx";
import { query } from "@/lib/db";
import { getConversations } from "@/lib/data/conversations";
import { getListings } from "@/lib/data/vault";
import { Card, Denied, Notice, PageHeader } from "@/components/ui";
import MapLoader from "@/components/MapLoader";
import { PENRITH_CENTER, SUBURB_CENTROIDS } from "@/lib/geo";
import { STAGES, STAGE_COLORS, type Site } from "@/lib/stages";

export default async function MapPage() {
  const ctx = await access("map");
  if (!ctx) return null;
  if (ctx === "denied") return <Denied />;
  const all = await query<Site>("select * from pipeline_sites where branch_id = $1 and lat is not null", [ctx.branch.id]);
  const sites = (ctx.liveOnly ? all.filter((s) => !s.is_sample) : all).filter((s) => s.lat != null && s.lng != null).map((s) => ({ id: s.id, address: s.address, suburb: s.suburb, stage: s.stage, stageName: STAGES[s.stage], color: STAGE_COLORS[s.stage], lat: s.lat!, lng: s.lng!, sample: s.is_sample }));
  const convos = await getConversations(ctx.branch.id);
  const listings = await getListings(ctx.branch.id, convos.data);

  const counts: Record<string, number> = {};
  for (const c of convos.data) for (const sub of Object.keys(SUBURB_CENTROIDS)) if (c.property.toUpperCase().includes(sub.toUpperCase())) counts[sub] = (counts[sub] || 0) + 1;
  const demand = Object.entries(counts).map(([suburb, count]) => ({ suburb, count, lat: SUBURB_CENTROIDS[suburb][0], lng: SUBURB_CENTROIDS[suburb][1] }));
  const pins = listings.data.filter((l) => l.lat && l.lng).slice(0, 80).map((l) => ({ id: l.id, address: l.address, lat: l.lat!, lng: l.lng! }));

  return (
    <>
      <PageHeader title="Map" status="prototype" sub="Pipeline sites, buyer demand and current listings." />
      <Notice>Playbook applications are not pinned yet: the Developer_playbook sheet holds no coordinates for them. Demand uses {convos.status === "live" ? "the live conversation log" : "no data until the conversation log is connected"}; listings use {listings.status === "live" ? "live Vault data" : "no data until Vault is connected"}.</Notice>
      <Card title="Sites, demand and listings" status="prototype">
        <MapLoader sites={sites} demand={demand} listings={pins} center={PENRITH_CENTER} />
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11 }} className="soft">
          {STAGES.map((s, i) => <span key={s} style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: STAGE_COLORS[i] }} />{s}</span>)}
        </div>
      </Card>
    </>
  );
}
