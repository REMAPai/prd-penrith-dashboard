import Link from "next/link";
import { access } from "@/lib/ctx";
import { getConversations } from "@/lib/data/conversations";
import { Card, Denied, Notice, StatusBadge, fmtDate } from "@/components/ui";
import { conversationDays, conversationsOnDay, dayLabel, splitDays, timeLabel, turnsOnDay } from "@/lib/buyer-days";
import { initials } from "@/lib/buyer-display";
import { agentsOf, applyFilters, parseStatus, type BuyerStatus } from "@/lib/buyer-filters";
import type { Conversation } from "@/lib/data/types";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const INSP: Record<string, string> = { not_discussed: "Not discussed", offered_not_answered: "Offered", asked_about_it: "Buyer asked", booked: "Booked" };

export default async function Buyer({ searchParams }: { searchParams: Promise<{ day?: string; q?: string; status?: string; agent?: string }> }) {
  const ctx = await access("buyer");
  if (!ctx) return null;
  if (ctx === "denied") return <Denied />;
  const sp = await searchParams;
  const res = await getConversations(ctx.branch.id);
  const days = conversationDays(res.data);
  const day = sp.day === "all" ? "all" : sp.day && days.includes(sp.day) ? sp.day : (days[0] ?? "all");
  const live = res.status === "live";

  const q = (sp.q ?? "").slice(0, 80);
  const status = parseStatus(sp.status);
  const agent = (sp.agent ?? "").slice(0, 80);
  const dayRows: { c: Conversation; when: string }[] =
    day === "all"
      ? res.data.slice().sort((a, b) => b.lastAt.localeCompare(a.lastAt)).map((c) => ({ c, when: fmtDate(c.lastAt) }))
      : conversationsOnDay(res.data, day).map(({ c, first }) => ({ c, when: timeLabel(first) }));
  const rows = applyFilters(dayRows, { q, status, agent });
  const agents = agentsOf(dayRows);
  const handed = rows.filter(({ c }) => c.readyForAgent).length;
  const replies = rows.reduce((n, { c }) => n + (day === "all" ? c.turns : turnsOnDay(c, day)).filter((x) => x.assistant).length, 0);
  const hot = rows.filter(({ c }) => c.temperature === "Hot").length;
  const { shown, older } = splitDays(days, day);
  const tabs: [string, string][] = [...shown.map((d): [string, string] => [d, d === days[0] ? `${dayLabel(d)} (latest)` : dayLabel(d)]), ["all", "All Data"]];

  return (
    <div className="bz-page">
      <section className="bz-hero">
        <div>
          <div className="bz-hero-title"><h1>Buyer Sequencing</h1><StatusBadge status={res.status} /></div>
          <div className="bz-hero-sub">{live ? `Every buyer and every reply, one tab per day (Sydney time). Updated ${fmtDate(res.asOf)}.` : "No conversations yet: the live log is not connected."}</div>
        </div>
      <form method="get" action="/buyer" className="bz-search" role="search">
        <input type="hidden" name="day" value={day} />
        <input type="hidden" name="status" value={status} />
        <input type="search" name="q" defaultValue={q} placeholder="Search buyer, property, source or agent" aria-label="Search buyers" />
        <select name="agent" defaultValue={agent} aria-label="Filter by agent">
          <option value="">All agents</option>
          {agents.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <button className="btn">Search</button>
        {(q || status !== "all" || agent) && <Link className="btn" href={`/buyer?day=${day}`}>Clear</Link>}
      </form>
      </section>
      {res.note && <Notice>{res.note}</Notice>}
      {live && !(res as { sendingLive?: boolean }).sendingLive && <Notice>Outbound sending is held. The assistant is working on real enquiries; replies are not being sent to buyers yet.</Notice>}
      <div className="bz-stats" aria-label="Summary for this tab">
        <div className="bz-stat"><div className="l">Buyers</div><div className="v">{rows.length}</div></div>
        <div className="bz-stat"><div className="l">Replies sent</div><div className="v">{replies}</div></div>
        <div className="bz-stat ok"><div className="l">Handed to agent</div><div className="v">{handed}</div></div>
        <div className="bz-stat hot"><div className="l">Hot buyers</div><div className="v">{hot}</div></div>
      </div>
      <nav className="bz-tabs" aria-label="Days">
        {tabs.map(([k, label]) => (
          <Link key={k} href={`/buyer?day=${k}`} className={day === k ? "on" : undefined} aria-current={day === k ? "page" : undefined}>{label}</Link>
        ))}
      </nav>
      {older.length > 0 && (
        <form method="get" action="/buyer" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label className="soft" style={{ fontSize: 12 }} htmlFor="older-day">Older days</label>
          <select id="older-day" name="day" defaultValue="" style={{ width: "auto" }}>
            <option value="" disabled>Choose a day</option>
            {older.map((d) => <option key={d} value={d}>{dayLabel(d)} {d.slice(0, 4)}</option>)}
          </select>
          <button className="btn sm">Open</button>
        </form>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {([["all", "All"], ["handed", "Handed to agent"], ["replying", "Assistant replying"], ["optedout", "Opted out"]] as [BuyerStatus, string][]).map(([k, label]) => (
          <Link key={k} className={`chip${status === k ? " on" : ""}`} aria-current={status === k ? "true" : undefined} href={`/buyer?day=${day}&status=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}${agent ? `&agent=${encodeURIComponent(agent)}` : ""}`}>{label}</Link>
        ))}
      </div>

      <form method="get" action="/buyer" style={{ display: "flex", gap: 8, flexWrap: "wrap" }} role="search">
        <input type="hidden" name="day" value={day} />
        <input type="hidden" name="status" value={status} />
        <input type="search" name="q" defaultValue={q} placeholder="Search buyer, property, source or agent" aria-label="Search buyers" style={{ flex: "1 1 260px", maxWidth: 420 }} />
        <select name="agent" defaultValue={agent} aria-label="Filter by agent" style={{ width: "auto", maxWidth: 220 }}>
          <option value="">All agents</option>
          {agents.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <button className="btn">Search</button>
        {(q || status !== "all" || agent) && <Link className="btn" href={`/buyer?day=${day}`}>Clear</Link>}
      </form>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {([["all", "All"], ["handed", "Handed to agent"], ["replying", "Assistant replying"]] as [BuyerStatus, string][]).map(([k, label]) => (
          <Link key={k} className={`chip${status === k ? " on" : ""}`} aria-current={status === k ? "true" : undefined} href={`/buyer?day=${day}&status=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}${agent ? `&agent=${encodeURIComponent(agent)}` : ""}`}>{label}</Link>
        ))}
      </div>

      <Card status={res.status} title={day === "all" ? "All Data" : dayLabel(day)} sub={`${plural(rows.length, "buyer")} · ${plural(replies, "reply").replace("replys", "replies")} · ${handed} handed to an agent. Open a name to see every message and reply.`} source={res.source}>
        <div style={{ overflow: "auto" }}>
          <table className="t bz" style={{ minWidth: 760 }}>
            <thead><tr><th>Buyer</th><th>Property</th><th>Source</th><th>Buyer type</th><th>Inspection</th><th>Status</th></tr></thead>
            <tbody>
              {rows.slice(0, 500).map(({ c, when }) => (
                <tr key={c.conversationId} className={c.temperature === "Hot" ? "hot" : undefined}>
                  <td style={{ fontWeight: 500 }}>
                    <div className="bz-buyer">
                      <span className={`bz-av ${c.temperature.toLowerCase()}`} aria-hidden="true">{initials(c.buyer)}</span>
                      <div>
                        <Link href={`/buyer/${encodeURIComponent(c.conversationId)}?day=${day}`}>{c.buyer || "Unknown buyer"}</Link>
                        <div className="bz-when">{day === "all" ? "Last message " : ""}{when}</div>
                      </div>
                    </div>
                  </td>
                  <td>{c.property}</td>
                  <td>{c.source && <span className="bz-tag">{c.source}</span>}</td>
                  <td><span className={`bz-pill ${c.temperature.toLowerCase()}`}>{c.temperature}</span></td>
                  <td className="soft">{INSP[c.inspection] ?? c.inspection}</td>
                  <td>{c.optedOut ? <span className="bz-pill hot">Opted out</span> : c.readyForAgent ? (c.handoffStatus === "done" ? <span className="bz-pill ok">Contacted by {c.agent || "agent"}</span> : <span className="bz-pill ok">With {c.agent || "agent"}</span>) : <span className="bz-pill info">Assistant replying</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <div className="soft" style={{ padding: 16 }}>{res.data.length === 0 ? "No buyers yet. Each enquiry appears here as soon as the assistant replies to it." : q || status !== "all" || agent ? "No buyers match your filters." : "No buyers for this day."}</div>}
        </div>
      </Card>
    </div>
  );
}
