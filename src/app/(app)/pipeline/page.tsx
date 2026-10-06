import { revalidatePath } from "next/cache";
import Link from "next/link";
import { access } from "@/lib/ctx";
import { query } from "@/lib/db";
import { Badge, Card, Denied, Drawer, Kpi, Notice, PageHeader, Tabs, fmtDate } from "@/components/ui";
import { audit } from "@/lib/session";
import { canEditPipeline } from "@/lib/roles";
import { STAGES, type Site } from "@/lib/stages";


const days = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));

async function moveStage(formData: FormData) {
  "use server";
  const ctx = await access("pipeline");
  if (!ctx || ctx === "denied" || !canEditPipeline(ctx.session.role)) return;
  const id = Number(formData.get("id"));
  const stage = Number(formData.get("stage"));
  if (!Number.isInteger(stage) || stage < 0 || stage > 9) return;
  const rows = await query<{ address: string; stage: number }>("select address, stage from pipeline_sites where id = $1 and branch_id = $2", [id, ctx.branch.id]);
  if (!rows[0] || rows[0].stage === stage) return;
  await query("update pipeline_sites set stage = $1, stage_changed_at = now(), updated_at = now() where id = $2", [stage, id]);
  const detail = `${STAGES[rows[0].stage]} to ${STAGES[stage]}`;
  await query("insert into pipeline_events (site_id, actor_email, kind, detail) values ($1,$2,'stage',$3)", [id, ctx.session.email, detail]);
  await audit(ctx.session.email, "Stage move", `${rows[0].address}: ${detail}`, ctx.branch.company_id, ctx.branch.id);
  revalidatePath("/pipeline");
}

async function confirmZoning(formData: FormData) {
  "use server";
  const ctx = await access("pipeline");
  if (!ctx || ctx === "denied" || !canEditPipeline(ctx.session.role)) return;
  const id = Number(formData.get("id"));
  const zoning = String(formData.get("zoning") || "").trim().slice(0, 80);
  if (!zoning) return;
  await query("update pipeline_sites set zoning = $1, zoning_confirmed = true, updated_at = now() where id = $2 and branch_id = $3", [zoning, id, ctx.branch.id]);
  await query("insert into pipeline_events (site_id, actor_email, kind, detail) values ($1,$2,'zoning',$3)", [id, ctx.session.email, `Zoning confirmed as ${zoning} (NSW Planning Portal Spatial Viewer)`]);
  await audit(ctx.session.email, "Zoning confirmed", `Site ${id}: ${zoning}`, ctx.branch.company_id, ctx.branch.id);
  revalidatePath("/pipeline");
}

export default async function Pipeline({ searchParams }: { searchParams: Promise<{ tab?: string; site?: string }> }) {
  const ctx = await access("pipeline");
  if (!ctx) return null;
  if (ctx === "denied") return <Denied />;
  const sp = await searchParams;
  const tab = sp.tab || "board";
  const all = await query<Site>("select * from pipeline_sites where branch_id = $1 order by priority, id", [ctx.branch.id]);
  const sites = ctx.liveOnly ? all.filter((s) => !s.is_sample) : all;
  const open = sp.site ? all.find((s) => String(s.id) === sp.site) : undefined;
  const events = open ? await query<{ at: string; actor_email: string; kind: string; detail: string }>("select at, actor_email, kind, detail from pipeline_events where site_id = $1 order by at desc limit 20", [open.id]) : [];
  const edit = canEditPipeline(ctx.session.role);
  const hasSample = all.some((s) => s.is_sample);
  const real = all.filter((s) => !s.is_sample);

  return (
    <>
      <PageHeader title="Development Pipeline" status="prototype" sub="From detected site to sold. The six real DAs from the tracker are live; the rest are labelled sample rows." />
      {hasSample && !ctx.liveOnly && <Notice>Rows marked Sample are invented to show the full pipeline. The six real DAs have zoning still to be confirmed before anyone acts on them.</Notice>}
      <div className="grid-kpi">
        <Kpi label="Real DAs tracked" value={real.length} />
        <Kpi label="Zoning still to confirm" value={real.filter((s) => !s.zoning_confirmed).length} />
        <Kpi label="Refused, under review" value={real.filter((s) => s.da_status === "Refused").length} />
        <Kpi label="Sites in pipeline (incl. sample)" value={sites.length} status="sample" />
      </div>
      <Tabs base="/pipeline" current={tab} tabs={[["board", "Board"], ["table", "Table"], ["snapshot", "Weekly snapshot"]]} />

      {tab === "board" && (
        <Card title="Pipeline board" sub="Open a card to move it or confirm zoning.">
          <div className="kanban">
            {STAGES.map((name, i) => {
              const col = sites.filter((s) => s.stage === i);
              return (
                <div className="col" key={name}>
                  <div style={{ fontSize: 12, fontWeight: 600, display: "flex", justifyContent: "space-between", padding: "2px 4px" }}><span>{name}</span><span className="soft" style={{ fontWeight: 400 }}>{col.length}</span></div>
                  {col.map((s) => (
                    <Link key={s.id} href={`/pipeline?tab=board&site=${s.id}`} className="kcard" style={{ color: "inherit" }}>
                      <div style={{ fontWeight: 500 }}>{s.address}</div>
                      <div className="soft">{s.suburb}{s.lot_size ? ` · ${s.lot_size}` : ""}</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <Badge tone={s.zoning_confirmed ? "done" : "prototype"}>{s.zoning_confirmed ? s.zoning : "Zoning TBC"}</Badge>
                        <Badge>{s.priority}</Badge>
                        {s.is_sample && <Badge tone="sample">Sample</Badge>}
                      </div>
                      <div className="soft" style={{ fontSize: 11 }}>{days(s.stage_changed_at)}d in stage</div>
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {tab === "table" && (
        <Card title="All sites">
          <div style={{ overflow: "auto" }}>
            <table className="t" style={{ minWidth: 820 }}>
              <thead><tr><th>Address</th><th>Suburb</th><th>Stage</th><th>Zoning</th><th>Signal</th><th>Priority</th><th>Next step</th></tr></thead>
              <tbody>
                {sites.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 500 }}><Link href={`/pipeline?tab=table&site=${s.id}`}>{s.address}</Link> {s.is_sample && <Badge tone="sample">Sample</Badge>}</td>
                    <td>{s.suburb}</td><td>{STAGES[s.stage]}</td>
                    <td><Badge tone={s.zoning_confirmed ? "done" : "prototype"}>{s.zoning_confirmed ? s.zoning : "TBC"}</Badge></td>
                    <td className="soft">{s.signal}</td><td>{s.priority}</td><td className="soft">{s.next_step}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "snapshot" && (
        <Card title="Weekly snapshot" sub="Mirrors the Weekly Snapshot tab in the tracker workbook (real rows only)." source="Postgres pipeline table">
          <table className="t"><tbody>
            {[
              ["New DAs identified this week", real.filter((s) => s.da_type === "DA" && days(s.identified_on) < 7).length],
              ["Approved this week", real.filter((s) => s.da_status === "Approved" && days(s.stage_changed_at) < 7).length],
              ["Refused (under review)", real.filter((s) => s.da_status === "Refused").length],
              ["Owner or director contact still needed", real.filter((s) => s.stage < 2).length],
              ["Approaches made (total)", real.filter((s) => s.stage >= 3).length],
            ].map(([k, v]) => <tr key={String(k)}><td>{k}</td><td style={{ fontWeight: 600 }}>{v}</td></tr>)}
          </tbody></table>
        </Card>
      )}

      {open && (
        <Drawer title={open.address} sub={`${open.suburb} · ${open.lot_size ?? "lot size to confirm"}`} closeHref={`/pipeline?tab=${tab}`}
          badges={<><Badge tone="red">{STAGES[open.stage]}</Badge><Badge tone={open.zoning_confirmed ? "done" : "prototype"}>{open.zoning_confirmed ? open.zoning : "Zoning TBC: confirm before acting"}</Badge>{open.is_sample && <Badge tone="sample">Sample row</Badge>}</>}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: "10px 16px" }}>
            {[["Signal", open.signal], ["DA", [open.da_type, open.da_status, open.da_number].filter(Boolean).join(" · ")], ["Source", open.source], ["Priority", open.priority], ["Assignee", open.assignee], ["Next step", open.next_step], ["Identified", open.identified_on?.toString().slice(0, 10)]].map(([k, v]) => (
              <div key={k as string}><div className="soft" style={{ fontSize: 11 }}>{k}</div><div style={{ fontWeight: 500 }}>{(v as string) || "Not set"}</div></div>
            ))}
          </div>
          {open.notes && <div className="soft">{open.notes}</div>}
          {edit && (
            <>
              <form action={moveStage} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <input type="hidden" name="id" value={open.id} />
                <div style={{ flex: 1 }}><div className="soft" style={{ fontSize: 11, marginBottom: 4 }}>Move to stage</div>
                  <select name="stage" defaultValue={open.stage}>{STAGES.map((n, i) => <option key={n} value={i}>{n}</option>)}</select></div>
                <button className="btn primary">Move</button>
              </form>
              {!open.zoning_confirmed && (
                <form action={confirmZoning} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <input type="hidden" name="id" value={open.id} />
                  <div style={{ flex: 1 }}><div className="soft" style={{ fontSize: 11, marginBottom: 4 }}>Zoning (from the NSW Planning Portal Spatial Viewer)</div>
                    <input name="zoning" placeholder="e.g. R3 Medium Density" required /></div>
                  <button className="btn">Confirm zoning</button>
                </form>
              )}
            </>
          )}
          <div>
            <div className="soft" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>History</div>
            {events.length === 0 && <div className="soft">No changes yet.</div>}
            {events.map((e, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--surface-soft)" }}><span>{e.detail}</span><span className="soft">{e.actor_email} · {fmtDate(e.at)}</span></div>)}
          </div>
        </Drawer>
      )}
    </>
  );
}
