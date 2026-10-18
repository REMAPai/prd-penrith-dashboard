import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { notFound } from "next/navigation";
import { access } from "@/lib/ctx";
import { getConversations, mask } from "@/lib/data/conversations";
import { Badge, Denied, Notice } from "@/components/ui";
import { audit } from "@/lib/session";
import { canMarkContacted, canRevealPii } from "@/lib/roles";
import { markContacted } from "./actions";
import { dayLabel, sydneyDay, timeLabel } from "@/lib/buyer-days";
import { titleName } from "@/lib/buyer-display";

const tone = (t: string) => (t === "Hot" ? "red" : t === "Warm" ? "prototype" : "grey");
const INSP: Record<string, string> = { not_discussed: "Not discussed", offered_not_answered: "Offered", asked_about_it: "Buyer asked", booked: "Booked" };
const VAULT: Record<string, string> = { yes: "Yes, listing found in Vault", no: "No record found", "": "Not recorded" };

function Field({ label, children, eye }: { label: string; children: React.ReactNode; eye?: React.ReactNode }) {
  return (
    <div className="bz-field">
      <div className="l">{label}</div>
      <div className="v">
        <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{children}</span>
        {eye}
      </div>
    </div>
  );
}

export default async function BuyerDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ day?: string; reveal?: string }> }) {
  const ctx = await access("buyer");
  if (!ctx) return null;
  if (ctx === "denied") return <Denied />;
  const { id } = await params;
  const sp = await searchParams;
  const res = await getConversations(ctx.branch.id);
  const c = res.data.find((x) => x.conversationId === decodeURIComponent(id));
  if (!c) notFound();

  const backDay = sp.day && /^(all|\d{4}-\d{2}-\d{2})$/.test(sp.day) ? sp.day : "all";
  const mayReveal = canRevealPii(ctx.session.role);
  const revealed = sp.reveal === "1" && mayReveal;
  const base = `/buyer/${encodeURIComponent(c.conversationId)}?day=${backDay}`;
  const eye = mayReveal ? (
    <Link href={revealed ? base : `${base}&reveal=1`} aria-label={revealed ? "Hide phone and email" : "Show phone and email (recorded in the audit log)"} title={revealed ? "Hide phone and email" : "Show phone and email (recorded in the audit log)"} style={{ display: "inline-flex", color: "var(--bz-ink-soft)" }}>
      {revealed ? <EyeOff size={18} /> : <Eye size={18} />}
    </Link>
  ) : null;
  if (revealed) await audit(ctx.session.email, "PII reveal", `Viewed contact details for a buyer conversation (${c.conversationId.slice(0, 24)})`, ctx.branch.company_id, ctx.branch.id);

  return (
    <div className="bz-page">
      <div><Link className="btn sm" href={`/buyer?day=${backDay}`}>Back to {backDay === "all" ? "All Data" : dayLabel(backDay)}</Link></div>
      <section className="bz-hero">
        <div className="bz-hero-title"><h1>{c.buyer || "Unknown buyer"}</h1><span className="bz-sub">{c.property}</span></div>
        <span style={{ display: "flex", gap: 6 }}>{c.optedOut && <Badge tone="red">Opted out</Badge>}<Badge tone={tone(c.temperature)}>{c.temperature}</Badge></span>
      </section>
      {res.note && <Notice>{res.note}</Notice>}
      {c.optedOut && <Notice>This buyer replied STOP. No more messages are sent to them.</Notice>}

      <div className="bz-fields">
        <Field label="Phone" eye={c.phone ? eye : null}>{revealed ? c.phone : mask(c.phone) || "Not captured"}</Field>
        <Field label="Email" eye={c.email ? eye : null}>{revealed ? c.email : mask(c.email, 6) || "Not captured"}</Field>
        <Field label="Buyer type">{c.temperature}</Field>
        <Field label="Property record in Vault">{VAULT[c.hadPropertyRecord] ?? c.hadPropertyRecord}</Field>
        <Field label="Source">{c.source || "Not captured"}</Field>
        <Field label="Inspection">{INSP[c.inspection] ?? c.inspection}</Field>
        <Field label="Handled by">
          {c.readyForAgent ? <>{titleName(c.agent) || "Agent not named"}{c.handoffStatus === "done" && <div style={{ marginTop: 4 }}><Badge tone="live">Contacted</Badge></div>}{c.agentEmail && <div className="soft" style={{ fontSize: 13, fontWeight: 400 }}>{c.agentEmail}</div>}</> : "Not handed over yet"}
        </Field>
        {c.readyForAgent && <Field label="Why handed over">{c.whyReady || "Actionable signal"}</Field>}
      </div>
      {c.readyForAgent && c.handoffStatus !== "done" && canMarkContacted(ctx.session.role) && (
        <form action={markContacted}>
          <input type="hidden" name="id" value={c.conversationId} />
          <button className="btn">Mark contacted</button>{" "}
          <span className="soft" style={{ fontSize: 12 }}>Use this once the agent has spoken to the buyer. It is recorded in the audit log.</span>
        </form>
      )}

      <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
        {c.turns.length === 0 && <div className="soft">No messages yet.</div>}
        {c.turns.map((t, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {t.buyer && (
              <div style={{ alignSelf: "flex-start", maxWidth: "78%" }}>
                <div className="bubble bz-bubble-buyer">{t.buyer}</div>
                <div className="soft" style={{ fontSize: 12, marginTop: 3 }}>Buyer · {dayLabel(sydneyDay(t.at))}, {timeLabel(t.at)}</div>
              </div>
            )}
            {t.assistant && (
              <div style={{ alignSelf: "flex-end", maxWidth: "78%" }}>
                <div className="bubble bz-bubble-reply">{t.assistant}</div>
                <div className="soft" style={{ fontSize: 12, marginTop: 3, textAlign: "right" }}>Assistant · {t.replyAt ? `${dayLabel(sydneyDay(t.replyAt))}, ${timeLabel(t.replyAt)}` : "time not recorded"}</div>
              </div>
            )}
          </div>
        ))}
        {c.readyForAgent && <div className="soft" style={{ textAlign: "center", fontSize: 12, borderTop: "1px solid var(--bz-line)", paddingTop: 10 }}>Handed over to {titleName(c.agent) || "an agent"}</div>}
      </div>
    </div>
  );
}
