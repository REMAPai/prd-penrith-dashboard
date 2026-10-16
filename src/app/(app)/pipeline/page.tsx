import { revalidatePath } from "next/cache";
import Link from "next/link";
import { access } from "@/lib/ctx";
import { query } from "@/lib/db";
import { Badge, Card, Denied, Drawer, Kpi, Notice, PageHeader, fmtDate } from "@/components/ui";
import { audit } from "@/lib/session";
import { canEditPipeline, canRevealPii } from "@/lib/roles";
import { STAGES, type Site } from "@/lib/stages";
import { inSheetWeek, weekLabel } from "@/lib/playbook";
import { mask } from "@/lib/data/conversations";

type WeekRow = { week_start: string; run_at: string; rows_total: number; items: number };
type Item = Site & { flag?: string | null };
type Company = { name: string; linked_address: string; acn_abn: string; asic_done: string; directors: string; role: string; contact_details: string; source_used: string; notes: string };

const NA = "Not available";

/** Why a value is missing, from facts about this row. Nothing here is a guess about the value itself. */
function why(field: "applicant" | "abn" | "zoning" | "contact" | "action", s: Site): string {
  if (field === "applicant") {
    if (s.da_type === "CDC") return "CDCs are not in the council tracker, so there is no applicant name.";
    if (s.lga === "Blue Mountains") return "The Blue Mountains council tracker is not connected yet.";
    return "This application was not in the Penrith council tracker's last 180 days.";
  }
  if (field === "abn") return "No ABN or ACN in the sheet yet. The ABN Lookup key is pending and the team has not entered one.";
  if (field === "zoning") return "The sheet has no zone for this row.";
  if (field === "contact") return "The sheet has no contact status for this row.";
  return "The sheet has no action recorded for this row.";
}

const Missing = ({ reason }: { reason: string }) => <span className="soft" title={reason}>{NA}</span>;

const NOT_IN_SHEET: [string, string][] = [
  ["Priority", "The sheet has no priority column. Every row already met the workflow's starter priority rule (cost of $1M or more, 3 or more dwellings, 2 or more lots, or key words). Darren has not confirmed that rule."],
  ["Lot size, floor space ratio, height", "Not in the tracker. They exist per lot in the separate Site Opportunity List sheet, which is not linked to an application."],
  ["Ownership signal, hold period", "Not recorded anywhere yet. The hold-period rule is undecided."],
  ["Assignee", "The sheet has no assignee column."],
  ["Map position", "The sheet has no coordinates, so applications cannot be placed on the Map."],
];

const statusTone = (s: string | null): "done" | "red" | "prototype" | "grey" => (s === "Approved" ? "done" : s === "Refused" ? "red" : s === "In Assessment" || s === "Lodged" ? "prototype" : "grey");

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

export default async function Playbook({ searchParams }: { searchParams: Promise<{ tab?: string; site?: string; week?: string }> }) {
  const ctx = await access("pipeline");
  if (!ctx) return null;
  if (ctx === "denied") return <Denied />;
  const sp = await searchParams;
  const tab = sp.tab || "status";

  const weeks = await query<WeekRow>(
    `select w.week_start::text as week_start, w.run_at, w.rows_total,
            (select count(*)::int from playbook_week_items i where i.branch_id = w.branch_id and i.week_start = w.week_start) as items
     from playbook_weeks w where w.branch_id = $1 order by w.week_start desc limit 52`,
    [ctx.branch.id],
  );
  const week = sp.week === "all" ? "all" : weeks.find((w) => w.week_start === sp.week)?.week_start ?? (weeks[0]?.week_start ?? "all");
  const current = weeks.find((w) => w.week_start === week);

  const all = await query<Site>(
    "select s.*, s.identified_on::text as identified_on from pipeline_sites s where s.branch_id = $1 and s.is_sample = false and s.site_kind = 'da' order by s.id",
    [ctx.branch.id],
  );
  const weekItems = week === "all" ? [] : await query<Item>(
    `select s.*, s.identified_on::text as identified_on, i.flag from playbook_week_items i join pipeline_sites s on s.id = i.site_id
     where i.branch_id = $1 and i.week_start = $2 and s.is_sample = false order by s.id`,
    [ctx.branch.id, week],
  );
  const sites: Item[] = week === "all" ? all : weekItems;
  const companies = tab === "companies"
    ? await query<Company>("select name, linked_address, acn_abn, asic_done, directors, role, contact_details, source_used, notes from playbook_companies where company_id = $1 order by name", [ctx.branch.company_id])
    : [];

  const open = sp.site ? all.find((s) => String(s.id) === sp.site) : undefined;
  const events = open ? await query<{ at: string; actor_email: string; kind: string; detail: string }>("select at, actor_email, kind, detail from pipeline_events where site_id = $1 order by at desc limit 20", [open.id]) : [];
  const edit = canEditPipeline(ctx.session.role);
  const reveal = canRevealPii(ctx.session.role);

  const href = (t: string, extra: Record<string, string> = {}) => `/pipeline?${new URLSearchParams({ tab: t, week, ...extra }).toString()}`;
  const closeHref = href(tab);

  // The Weekly Snapshot tab in the sheet counts rows by Date Identified inside the week. Repeat it so both agree.
  const inWeek = (s: Site) => week === "all" || inSheetWeek(s.identified_on, week);
  const snapshot: [string, React.ReactNode][] = [
    ["New DAs identified", all.filter((s) => s.da_type === "DA" && inWeek(s)).length],
    ["New CDCs identified", all.filter((s) => s.da_type === "CDC" && inWeek(s)).length],
    ["Approved", all.filter((s) => s.da_status === "Approved" && inWeek(s)).length],
    ["Refused", all.filter((s) => s.da_status === "Refused" && inWeek(s)).length],
    ["Owner or director contact still needed", all.filter((s) => s.contact_found === "Not yet found").length],
    ["Approaches made", all.filter((s) => s.action_taken === "Contacted" && inWeek(s)).length],
    ["Farm suburbs with active leads", <Missing key="farm" reason="The Zoning Farm List is filled by hand by the team and is not part of this feed." />],
  ];

  const weekBar = (
    <div className="chips" aria-label="Week">
      {weeks.map((w) => (
        <Link key={w.week_start} href={`/pipeline?${new URLSearchParams({ tab, week: w.week_start }).toString()}`} className={`chip ${week === w.week_start ? "on" : ""}`}>
          {weekLabel(w.week_start)} <span className="soft">{w.items}</span>
        </Link>
      ))}
      <Link href={`/pipeline?${new URLSearchParams({ tab, week: "all" }).toString()}`} className={`chip ${week === "all" ? "on" : ""}`}>All weeks <span className="soft">{all.length}</span></Link>
    </div>
  );

  const tabLink = (k: string, label: string) => <Link key={k} href={href(k)} className={tab === k ? "on" : ""}>{label}</Link>;

  const card = (s: Item) => (
    <Link key={s.id} href={href(tab, { site: String(s.id) })} className="kcard" style={{ color: "inherit" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}><b>{s.da_number}</b><Badge>{s.da_type}</Badge></div>
      <div>{s.address}</div>
      <div className="soft">{s.suburb}</div>
      <Badge tone={s.zoning_confirmed ? "done" : "prototype"}>{s.zoning_confirmed ? s.zoning : "Zoning TBC"}</Badge>
    </Link>
  );
  // Columns come from the status the sheet holds. Nothing is added that the sheet does not have.
  const statusCols = [...new Set(["In Assessment", "Approved", "Refused", ...sites.map((s) => s.da_status).filter((x): x is string => !!x)])];

  return (
    <>
      <PageHeader title="Development Playbook" status="prototype" sub={`${ctx.branch.name}: applications found by the weekly run, as written in the Developer_playbook sheet.`} />
      {weeks.length === 0 && <Notice>No weekly run has reached the dashboard yet. When the Monday run finishes it posts here and its week appears below, with the same rows the sheet shows.</Notice>}
      {sites.some((s) => !s.zoning_confirmed) && <Notice>Some rows have no zone in the sheet, so zoning still has to be confirmed before anyone acts on them.</Notice>}

      <div className="grid-kpi">
        <Kpi label={week === "all" ? "Applications tracked" : "Flagged this week"} value={week === "all" ? sites.length : sites.filter((s) => s.flag).length} />
        <Kpi label="DAs" value={sites.filter((s) => s.da_type === "DA").length} />
        <Kpi label="CDCs" value={sites.filter((s) => s.da_type === "CDC").length} />
        <Kpi label="Approved" value={sites.filter((s) => s.da_status === "Approved").length} />
        <Kpi label="Refused" value={sites.filter((s) => s.da_status === "Refused").length} />
      </div>

      <div className="tabs">
        {tabLink("status", "By status")}
        {tabLink("table", "DA & CDC Tracker")}
        {tabLink("companies", "Companies")}
        {tabLink("snapshot", "Weekly snapshot")}
        {tabLink("gaps", "Data not in the sheet")}
      </div>

      {tab !== "companies" && tab !== "gaps" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="soft" style={{ fontSize: 12 }}>
            {current ? `Run received ${fmtDate(current.run_at)}. ${current.rows_total} rows in the sheet for ${ctx.branch.name} that week, ${weekItems.filter((s) => s.flag).length} flagged as new or changed.` : week === "all" ? "Every application the weekly runs have recorded, whichever week it first appeared." : ""}
          </div>
          {weekBar}
        </div>
      )}

      {tab === "status" && (
        <Card title="By status" sub={week === "all" ? "All weeks. Open a card to see every field." : `Week of ${weekLabel(week)}. Open a card to see every field.`} source="Developer_playbook sheet, DA & CDC Tracker tab">
          <div className="kanban">
            {statusCols.map((name) => {
              const col = sites.filter((s) => s.da_status === name);
              return (
                <div className="col" key={name}>
                  <div style={{ fontSize: 12, fontWeight: 600, display: "flex", justifyContent: "space-between", padding: "2px 4px" }}><span>{name}</span><span className="soft" style={{ fontWeight: 400 }}>{col.length}</span></div>
                  {col.map(card)}
                </div>
              );
            })}
            {sites.some((s) => !s.da_status) && (
              <div className="col">
                <div style={{ fontSize: 12, fontWeight: 600, display: "flex", justifyContent: "space-between", padding: "2px 4px" }}><span>No status in the sheet</span><span className="soft" style={{ fontWeight: 400 }}>{sites.filter((s) => !s.da_status).length}</span></div>
                {sites.filter((s) => !s.da_status).map(card)}
              </div>
            )}
            <div className="col">
              <div style={{ fontSize: 12, fontWeight: 600, padding: "2px 4px" }}>Not covered: paid access needed</div>
              <div className="kcard" style={{ cursor: "default" }}>
                <div>ACN/ABN</div>
                <div>Director names and roles</div>
                <div>Phone and email of those people</div>
                <div>Developer and architect contacts</div>
                <div className="soft">No free source holds these. They fill in once paid access is in place.</div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {tab === "table" && (
        <Card title="DA & CDC Tracker" sub={week === "all" ? "All weeks" : `Week of ${weekLabel(week)}`} source="Developer_playbook sheet, DA & CDC Tracker tab">
          <div style={{ overflow: "auto" }}>
            <table className="t compact">
              <thead>
                <tr><th>Application</th><th>Property</th><th>Status</th><th>Zoning</th><th>Applicant</th><th>ACN/ABN (if known)</th><th>Contact Found?</th><th>Action Taken</th>{week !== "all" && <th>This week</th>}<th>First seen</th></tr>
              </thead>
              <tbody>
                {sites.length === 0 && <tr><td colSpan={11} className="soft">No applications for this selection.</td></tr>}
                {sites.map((s) => (
                  <tr key={s.id} title={s.notes ?? ""}>
                    <td className="nw"><Link href={href("table", { site: String(s.id) })}><b>{s.da_number}</b></Link> <Badge>{s.da_type}</Badge></td>
                    <td className="clip"><div><Link href={href("table", { site: String(s.id) })}>{s.address}</Link></div><div className="soft">{s.suburb}</div></td>
                    <td className="nw">{s.da_status ? <Badge tone={statusTone(s.da_status)}>{s.da_status}</Badge> : <Missing reason="The sheet has no status for this row. A determined application has its outcome checked on the council tracker." />}</td>
                    <td className="nw">{s.zoning_confirmed ? <span title={s.zoning_source ?? ""}>{s.zoning}{s.zone_code && s.zone_code !== s.zoning ? <span className="soft"> · {s.zone_code}</span> : ""}</span> : <Missing reason={why("zoning", s)} />}</td>
                    <td className="clip">{s.applicant ?? <Missing reason={why("applicant", s)} />}</td>
                    <td className="nw">{s.abn ?? <Missing reason={why("abn", s)} />}</td>
                    <td className="nw">{s.contact_found ?? <Missing reason={why("contact", s)} />}</td>
                    <td className="nw">{s.action_taken ?? <Missing reason={why("action", s)} />}</td>
                    {week !== "all" && <td className="nw soft">{s.flag}</td>}
                    <td className="nw soft">{s.identified_on?.toString().slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "companies" && (
        <Card title="Companies" sub="The Director & Company Lookup tab. The workflow adds the company name and address. Everything else is filled by hand by the team." source="Developer_playbook sheet, Director & Company Lookup tab">
          <div style={{ overflow: "auto" }}>
            <table className="t compact">
              <thead><tr><th>Company</th><th>Linked address</th><th>ACN / ABN</th><th>ASIC search done?</th><th>Directors</th><th>Role</th><th>Phone / email</th><th>Source used</th><th>Notes</th></tr></thead>
              <tbody>
                {companies.length === 0 && <tr><td colSpan={9} className="soft">No companies have reached the dashboard yet.</td></tr>}
                {companies.map((c) => {
                  const empty = (v: string) => (v ? v : <span className="soft" title="Filled by hand by the team once the company is researched. Not in the sheet yet.">Not yet researched</span>);
                  return (
                    <tr key={c.name}>
                      <td className="clip"><b>{c.name}</b></td><td className="clip">{c.linked_address}</td>
                      <td className="nw">{empty(c.acn_abn)}</td><td className="nw">{empty(c.asic_done)}</td><td className="clip">{empty(c.directors)}</td><td className="nw">{empty(c.role)}</td>
                      <td className="nw">{c.contact_details ? (reveal ? c.contact_details : mask(c.contact_details)) : empty("")}</td>
                      <td className="nw">{empty(c.source_used)}</td><td className="clip">{c.notes}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "snapshot" && (
        <Card title="Weekly snapshot" sub={`${week === "all" ? "All weeks" : `Week of ${weekLabel(week)}`}. Counted the way the Weekly Snapshot tab in the sheet counts them.`} source="Developer_playbook sheet">
          <table className="t compact"><tbody>{snapshot.map(([k, v]) => <tr key={k}><td>{k}</td><td style={{ fontWeight: 600 }}>{v}</td></tr>)}</tbody></table>
        </Card>
      )}

      {tab === "gaps" && (
        <Card title="Data not in the sheet" sub="These fields are kept so the gap is visible. Nothing has been assumed or filled in.">
          <table className="t compact"><tbody>{NOT_IN_SHEET.map(([k, v]) => <tr key={k}><td className="nw"><b>{k}</b></td><td>{v}</td></tr>)}</tbody></table>
        </Card>
      )}

      {open && (
        <Drawer title={open.address} sub={`${open.suburb} · ${open.lga ?? ""}`} closeHref={closeHref}
          badges={<>{open.da_status && <Badge tone={statusTone(open.da_status)}>{open.da_status}</Badge>}<Badge tone={open.zoning_confirmed ? "done" : "prototype"}>{open.zoning_confirmed ? open.zoning : "Zoning TBC: confirm before acting"}</Badge></>}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: "10px 16px" }}>
            {([
              ["Application", [open.da_type, open.da_number].filter(Boolean).join(" · ")],
              ["Council", open.lga],
              ["Date identified", open.identified_on?.toString().slice(0, 10)],
              ["Zoning", open.zoning_confirmed ? [open.zoning, open.zone_code !== open.zoning ? open.zone_code : null, open.zone_name].filter(Boolean).join(" · ") : null, why("zoning", open)],
              ["Zoning source", open.zoning_source],
              ["Applicant / company", open.applicant, why("applicant", open)],
              ["ACN / ABN", open.abn, why("abn", open)],
              ["Contact found", open.contact_found, why("contact", open)],
              ["Action taken", open.action_taken, why("action", open)],
              ["Source portal", open.source],
            ] as [string, string | null | undefined, string?][]).map(([k, v, reason]) => (
              <div key={k}><div className="soft" style={{ fontSize: 11 }}>{k}</div><div style={{ fontWeight: 500 }}>{v || <Missing reason={reason ?? "Not in the sheet."} />}</div></div>
            ))}
          </div>
          {open.notes && <div><div className="soft" style={{ fontSize: 11 }}>Notes / next step (from the sheet)</div><div>{open.notes}</div></div>}
          <div className="soft" style={{ fontSize: 12 }}>Not in the sheet for this application: {NOT_IN_SHEET.map(([k]) => k.toLowerCase()).join(", ")}. See Data not in the sheet.</div>
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
