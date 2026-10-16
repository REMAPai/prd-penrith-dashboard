import Link from "next/link";
import { access } from "@/lib/ctx";
import { getConversations } from "@/lib/data/conversations";
import { Badge, Card, Denied, Notice, PageHeader, Tabs, fmtDate } from "@/components/ui";
import { conversationDays, conversationsOnDay, dayLabel, timeLabel, turnsOnDay } from "@/lib/buyer-days";
import type { Conversation } from "@/lib/data/types";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const tone = (t: string) => (t === "Hot" ? "red" : t === "Warm" ? "prototype" : "grey");
const INSP: Record<string, string> = { not_discussed: "Not discussed", offered_not_answered: "Offered", asked_about_it: "Buyer asked", booked: "Booked" };

export default async function Buyer({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const ctx = await access("buyer");
  if (!ctx) return null;
  if (ctx === "denied") return <Denied />;
  const sp = await searchParams;
  const res = await getConversations(ctx.branch.id);
  const days = conversationDays(res.data);
  const day = sp.day === "all" ? "all" : sp.day && days.includes(sp.day) ? sp.day : (days[0] ?? "all");
  const live = res.status === "live";

  const rows: { c: Conversation; when: string }[] =
    day === "all"
      ? res.data.slice().sort((a, b) => b.lastAt.localeCompare(a.lastAt)).map((c) => ({ c, when: fmtDate(c.lastAt) }))
      : conversationsOnDay(res.data, day).map(({ c, first }) => ({ c, when: timeLabel(first) }));
  const handed = rows.filter(({ c }) => c.readyForAgent).length;
  const replies = rows.reduce((n, { c }) => n + (day === "all" ? c.turns : turnsOnDay(c, day)).filter((x) => x.assistant).length, 0);
  const tabs: [string, string][] = [...days.map((d, i): [string, string] => [d, i === 0 ? `${dayLabel(d)} (latest)` : dayLabel(d)]), ["all", "All Data"]];

  return (
    <>
      <PageHeader title="Buyer Sequencing" status={res.status} sub={live ? `Every buyer and every reply, one tab per day (Sydney time). Updated ${fmtDate(res.asOf)}.` : "No conversations yet: the live log is not connected."} />
      {res.note && <Notice>{res.note}</Notice>}
      {live && !(res as { sendingLive?: boolean }).sendingLive && <Notice>Outbound sending is held. The assistant is working on real enquiries; replies are not being sent to buyers yet.</Notice>}
      <Tabs base="/buyer" param="day" current={day} tabs={tabs} />

      <Card status={res.status} title={day === "all" ? "All Data" : dayLabel(day)} sub={`${plural(rows.length, "buyer")} · ${plural(replies, "reply").replace("replys", "replies")} · ${handed} handed to an agent. Open a name to see every message and reply.`} source={res.source}>
        <div style={{ overflow: "auto" }}>
          <table className="t" style={{ minWidth: 760 }}>
            <thead><tr><th>{day === "all" ? "Last message" : "First message"}</th><th>Buyer</th><th>Property</th><th>Source</th><th>Buyer type</th><th>Inspection</th><th>Status</th></tr></thead>
            <tbody>
              {rows.slice(0, 500).map(({ c, when }) => (
                <tr key={c.conversationId} className={c.temperature === "Hot" ? "hot" : undefined}>
                  <td className="soft">{when}</td>
                  <td style={{ fontWeight: 500 }}><Link href={`/buyer/${encodeURIComponent(c.conversationId)}?day=${day}`}>{c.buyer || "Unknown buyer"}</Link></td>
                  <td>{c.property}</td>
                  <td className="soft">{c.source}</td>
                  <td><Badge tone={tone(c.temperature)}>{c.temperature}</Badge></td>
                  <td className="soft">{INSP[c.inspection] ?? c.inspection}</td>
                  <td>{c.readyForAgent ? <Badge tone="done">With {c.agent || "agent"}</Badge> : <Badge tone="grey">Assistant replying</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <div className="soft" style={{ padding: 16 }}>No buyers for this day.</div>}
        </div>
      </Card>
    </>
  );
}
