import { nowMs } from "@/lib/time";
import { revalidatePath } from "next/cache";
import { access } from "@/lib/ctx";
import { query } from "@/lib/db";
import { Badge, Card, Denied, PageHeader, StatusBadge } from "@/components/ui";
import type { Status } from "@/lib/roles";
import { audit } from "@/lib/session";

type Item = { id: number; project: string; kind: string; text: string; owner: string | null; due: string | null; status: string };

// Percent = share of SRS requirements marked Done for the project (rounded estimate, see docs/requirements/srs.md).
const PROJECTS: { name: string; status: Status; pct: number; body: string; next: string }[] = [
  { name: "Buyer Sequencing", status: "live", pct: 72, body: "Answers portal enquiries from live Vault data and logs every conversation. Outbound sending is held until the inbound reply rule is set.", next: "Release outbound send" },
  { name: "Development Pipeline", status: "prototype", pct: 35, body: "Real DAs are loaded and tracked through ten stages. Zoning still has to be confirmed before any priority list.", next: "Confirm field list with Darren" },
  { name: "Meta Lead Funnel", status: "waiting", pct: 15, body: "Scoped. Landing-page enquiries still go through a manual sheet. Direct messages wait on Meta approval.", next: "Confirm form wiring to Vault" },
  { name: "After-hours Voice Agent", status: "planned", pct: 5, body: "Prototype only. No build until Buyer Sequencing is stable and the scope and cost are approved.", next: "Scope and cost sign-off" },
  { name: "Google Reviews", status: "planned", pct: 0, body: "Parked after the realestate.com.au conversation.", next: "Reactivate when asked" },
];

const ENGAGEMENT_START = new Date("2026-08-18T00:00:00+10:00");

async function toggleAsk(formData: FormData) {
  "use server";
  const ctx = await access("progress");
  if (!ctx || ctx === "denied" || ctx.session.role === "viewer") return;
  const id = Number(formData.get("id"));
  const rows = await query<{ status: string; text: string }>("update progress_items set status = case when status = 'done' then 'open' else 'done' end where id = $1 and kind = 'ask' returning status, text", [id]);
  if (rows[0]) await audit(ctx.session.email, "Progress item", `${rows[0].status === "done" ? "Done" : "Reopened"}: ${rows[0].text}`, ctx.branch.company_id, ctx.branch.id);
  revalidatePath("/progress");
}

export default async function Progress() {
  const ctx = await access("progress");
  if (!ctx) return null;
  if (ctx === "denied") return <Denied />;
  const items = await query<Item>("select id, project, kind, text, owner, due, status from progress_items order by id");
  const day = Math.max(1, Math.ceil((nowMs() - ENGAGEMENT_START.getTime()) / 86400000));
  const canTick = ctx.session.role !== "viewer";

  return (
    <>
      <PageHeader title="Delivery Progress" status="live" sub={`What is done, what is next, and what we need from you. Day ${day} of the engagement. Next call: Wednesday 2pm AEST.`} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        <Card basis="100%">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
            {PROJECTS.map((p) => {
              const asks = items.filter((i) => i.kind === "ask" && i.project === p.name);
              return (
                <div className="proj" key={p.name}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div className="ring" style={{ background: `conic-gradient(var(--brand) ${p.pct * 3.6}deg, var(--planned-tint) 0)` }}><div>{p.pct}%</div></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <StatusBadge status={p.status} />
                    </div>
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.5 }}>{p.body}</div>
                  <div className="soft" style={{ fontSize: 12 }}>Next: {p.next}</div>
                  {asks.map((a) => (
                    <form key={a.id} action={toggleAsk} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                      <input type="hidden" name="id" value={a.id} />
                      <div style={{ flex: 1, opacity: a.status === "done" ? 0.5 : 1, textDecoration: a.status === "done" ? "line-through" : "none" }}>{a.text} ({a.owner})</div>
                      {canTick && <button className={`btn sm ${a.status === "done" ? "" : "tint"}`}>{a.status === "done" ? "Reopen" : "Mark done"}</button>}
                    </form>
                  ))}
                </div>
              );
            })}
          </div>
          <div className="soft" style={{ fontSize: 11 }}>Percent is an estimate: share of the agreed requirements finished for each project.</div>
        </Card>
        <Card title="30-day milestones" basis="420px">
          <table className="t"><tbody>
            {items.filter((i) => i.kind === "milestone").map((m) => (
              <tr key={m.id}><td>{m.text}</td><td><Badge tone={m.due === "done" ? "done" : "prototype"}>{m.due === "done" ? "Done" : "Next"}</Badge></td></tr>
            ))}
          </tbody></table>
        </Card>
        <Card title="This week we shipped" basis="320px">
          <table className="t"><tbody>
            {items.filter((i) => i.kind === "shipped").map((m) => <tr key={m.id}><td>{m.text}</td></tr>)}
          </tbody></table>
        </Card>
        <Card title="Blockers" basis="320px">
          <table className="t"><tbody>
            {items.filter((i) => i.kind === "blocker").map((m) => (
              <tr key={m.id}><td>{m.text}</td><td className="soft">{m.owner} · {m.due}</td></tr>
            ))}
          </tbody></table>
        </Card>
      </div>
    </>
  );
}
