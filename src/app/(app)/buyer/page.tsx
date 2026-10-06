import { nowMs } from "@/lib/time";
import Link from "next/link";
import { access } from "@/lib/ctx";
import { getConversations, mask, qualityFlags } from "@/lib/data/conversations";
import { Badge, Bars, Card, Denied, Drawer, Kpi, Notice, PageHeader, Tabs, fmtDate } from "@/components/ui";
import { audit } from "@/lib/session";
import { canRevealPii } from "@/lib/roles";
import type { Conversation } from "@/lib/data/types";

const median = (a: number[]) => { const x = [...a].sort((p, q) => p - q); return x.length ? x[Math.floor(x.length / 2)] : 0; };
const overdue = (c: Conversation) => c.readyForAgent && c.handoffStatus === "pending" && !!c.slaDueAt && new Date(c.slaDueAt).getTime() < nowMs();
const replyMins = (c: Conversation) => { const t = c.turns[0]; return t?.replyAt ? Math.max(0, (new Date(t.replyAt).getTime() - new Date(t.at).getTime()) / 60000) : null; };
const tone = (t: string) => (t === "Hot" ? "red" : t === "Warm" ? "prototype" : "grey");
const INSP: Record<string, string> = { not_discussed: "Not discussed", offered_not_answered: "Offered", asked_about_it: "Buyer asked", booked: "Booked" };

export default async function Buyer({ searchParams }: { searchParams: Promise<{ tab?: string; c?: string; reveal?: string; test?: string }> }) {
  const ctx = await access("buyer");
  if (!ctx) return null;
  if (ctx === "denied") return <Denied />;
  const sp = await searchParams;
  const tab = sp.tab || "conversations";
  const res = await getConversations(ctx.branch.id);
  const all = res.data;
  const rows = all.slice().sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  const week = rows.filter((c) => nowMs() - new Date(c.startedAt).getTime() < 7 * 86400000);
  const open = sp.c ? rows.find((c) => c.conversationId === sp.c) : undefined;
  const flags = qualityFlags(rows);
  const revealed = !!open && sp.reveal === open.conversationId && canRevealPii(ctx.session.role);
  if (revealed) await audit(ctx.session.email, "PII reveal", `Viewed contact details for a buyer conversation (${open!.conversationId.slice(0, 24)})`, ctx.branch.company_id, ctx.branch.id);
  const live = res.status === "live";
  const st = res.status;

  const funnel = [
    ["Enquiries", rows.length],
    ["Buyer replied", rows.filter((c) => c.turns.length > 1).length],
    ["Inspection offered or booked", rows.filter((c) => c.inspection !== "not_discussed").length],
    ["Handed over and confirmed", rows.filter((c) => c.handoffStatus === "done").length],
    ["Hot", rows.filter((c) => c.temperature === "Hot").length],
  ] as [string, number][];

  return (
    <>
      <PageHeader title="Buyer Sequencing" status={st === "live" ? "live" : st} sub={live ? `Real conversations from the conversation log. Updated ${fmtDate(res.asOf)}.` : "No conversations yet: the live log is not connected."} />
      {res.note && <Notice>{res.note}</Notice>}
      {live && !(res as { sendingLive?: boolean }).sendingLive && <Notice>Outbound sending is held. The assistant is working on real enquiries; replies are not being sent to buyers yet.</Notice>}
      <div className="grid-kpi">
        <Kpi label="Enquiries (7 days)" value={week.length} status={st} />
        <Kpi label="After hours" value={week.filter((c) => c.afterHours).length} status={st} />
        <Kpi label="Hot buyers" value={rows.filter((c) => c.temperature === "Hot").length} status={st} />
        <Kpi label="Median turns per chat" value={median(rows.map((c) => c.turns.length))} status={st} />
        <Kpi label="Median first reply (min)" value={Math.round(median(rows.map(replyMins).filter((m): m is number => m !== null)))} status={st} />
        <Kpi label="Handoffs past deadline" value={rows.filter(overdue).length} status={st} />
      </div>
      <Tabs base="/buyer" current={tab} tabs={[["conversations", "Conversations"], ["funnel", "Funnel"], ["handovers", "Handovers"], ["quality", "Quality"]]} />

      {tab === "conversations" && (
        <Card status={st} title="Conversations" sub="Newest first. Contact details are masked until revealed." source={res.source}>
          <div style={{ overflow: "auto" }}>
            <table className="t" style={{ minWidth: 760 }}>
              <thead><tr><th>Last message</th><th>Buyer</th><th>Property</th><th>Source</th><th>Buyer type</th><th>Inspection</th><th>Status</th></tr></thead>
              <tbody>
                {rows.slice(0, 80).map((c) => (
                  <tr key={c.conversationId} className="click">
                    <td className="soft"><Link href={`/buyer?tab=conversations&c=${encodeURIComponent(c.conversationId)}`}>{fmtDate(c.lastAt)}</Link></td>
                    <td style={{ fontWeight: 500 }}>{c.buyer}</td>
                    <td>{c.property}</td>
                    <td className="soft">{c.source}</td>
                    <td><Badge tone={tone(c.temperature)}>{c.temperature}</Badge></td>
                    <td className="soft">{INSP[c.inspection] ?? c.inspection}</td>
                    <td>{c.readyForAgent ? <Badge tone="done">With {c.agent || "agent"}</Badge> : <Badge tone="grey">Assistant replying</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "funnel" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
          <Card status={st} title="Funnel" sub="All conversations in the log" basis="380px" source={res.source}>
            <Bars items={funnel.map(([label, value]) => ({ label, value }))} />
          </Card>
          <Card status={st} title="Where enquiries come from" basis="380px" source={res.source}>
            <Bars items={Object.entries(rows.reduce<Record<string, number>>((a, c) => ({ ...a, [c.source || "Unknown"]: (a[c.source || "Unknown"] || 0) + 1 }), {})).map(([label, value]) => ({ label, value }))} />
          </Card>
          <Card status={st} title="Time of enquiry" basis="380px" sub="After hours is outside 8am to 6pm Sydney time" source={res.source}>
            <Bars items={[{ label: "In hours", value: rows.filter((c) => !c.afterHours).length }, { label: "After hours", value: rows.filter((c) => c.afterHours).length }]} />
          </Card>
        </div>
      )}

      {tab === "handovers" && (
        <Card status={st} title="Handovers" sub="Buyers passed to an agent, with the reason" source={res.source}>
          <table className="t"><thead><tr><th>Buyer</th><th>Property</th><th>Agent</th><th>Why</th><th>Type</th></tr></thead>
            <tbody>
              {rows.filter((c) => c.readyForAgent).slice(0, 60).map((c) => (
                <tr key={c.conversationId}>
                  <td style={{ fontWeight: 500 }}><Link href={`/buyer?tab=handovers&c=${encodeURIComponent(c.conversationId)}`}>{c.buyer}</Link></td>
                  <td>{c.property}</td><td>{c.agent || "Unassigned"}</td><td className="soft">{c.whyReady || "Actionable signal"}</td>
                  <td><Badge tone={tone(c.temperature)}>{c.temperature}</Badge></td>
                </tr>
              ))}
            </tbody></table>
        </Card>
      )}

      {tab === "quality" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
          <Card status={st} title="Automatic checks" sub="Problems the assistant should never repeat" basis="380px" source="Computed from the conversation log">
            <Bars items={Object.entries(flags.reduce<Record<string, number>>((a, f) => ({ ...a, [f.kind]: (a[f.kind] || 0) + 1 }), {})).map(([label, value]) => ({ label, value }))} />
            {flags.length === 0 && <div className="soft">No flags found.</div>}
          </Card>
          <Card status={st} title="Examples" basis="380px" source="Computed from the conversation log">
            <table className="t"><tbody>
              {flags.slice(0, 12).map((f, i) => (
                <tr key={i}><td><Link href={`/buyer?tab=quality&c=${encodeURIComponent(f.id)}`}>{f.example}</Link></td><td className="soft">{f.kind}</td></tr>
              ))}
            </tbody></table>
          </Card>
        </div>
      )}

      {open && <Thread c={open} closeHref={`/buyer?tab=${tab}`} showContact={revealed} />}
    </>
  );
}

function Thread({ c, closeHref, showContact }: { c: Conversation; closeHref: string; showContact: boolean }) {
  return (
    <Drawer title={c.buyer} sub={c.property} closeHref={closeHref} badges={<><Badge tone={tone(c.temperature)}>{c.temperature}</Badge><Badge>{c.source}</Badge>{c.afterHours && <Badge tone="prototype">After hours</Badge>}</>}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: "10px 16px" }}>
        {[["Buyer type", c.buyerType], ["Finance", c.financeStatus], ["Needs to sell first", c.needsToSellFirst], ["Timeframe", c.timeframe], ["Inspection", INSP[c.inspection] ?? c.inspection], ["Consent", c.consent], ["Agent", c.agent]].map(([k, v]) => (
          <div key={k}><div className="soft" style={{ fontSize: 11 }}>{k}</div><div style={{ fontWeight: 500 }}>{v || "Not captured"}</div></div>
        ))}
        <div>
          <div className="soft" style={{ fontSize: 11 }}>Contact</div>
          <div style={{ fontWeight: 500 }}>{showContact ? `${c.phone} · ${c.email}` : `${mask(c.phone)} · ${mask(c.email, 6)}`}</div>
          {!showContact && <Link className="btn sm" href={`${closeHref}&c=${encodeURIComponent(c.conversationId)}&reveal=${encodeURIComponent(c.conversationId)}`}>Reveal</Link>}
        </div>
      </div>
      {c.whyReady && <div className="notice">Why handed over: {c.whyReady}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {c.turns.map((t, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {t.buyer && <div style={{ display: "flex" }}><div className="bubble" style={{ background: "var(--surface-soft)" }}><div className="soft" style={{ fontSize: 10 }}>Buyer · {fmtDate(t.at)}</div>{t.buyer}</div></div>}
            {t.assistant && <div style={{ display: "flex", justifyContent: "flex-end" }}><div className="bubble" style={{ background: "var(--brand-tint)" }}><div className="soft" style={{ fontSize: 10 }}>Assistant</div>{t.assistant}</div></div>}
          </div>
        ))}
      </div>
    </Drawer>
  );
}
