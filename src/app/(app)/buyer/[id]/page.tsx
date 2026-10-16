import Link from "next/link";
import { notFound } from "next/navigation";
import { access } from "@/lib/ctx";
import { getConversations, mask } from "@/lib/data/conversations";
import { Badge, Denied, Notice } from "@/components/ui";
import { audit } from "@/lib/session";
import { canRevealPii } from "@/lib/roles";
import { dayLabel, sydneyDay, timeLabel } from "@/lib/buyer-days";

const tone = (t: string) => (t === "Hot" ? "red" : t === "Warm" ? "prototype" : "grey");
const INSP: Record<string, string> = { not_discussed: "Not discussed", offered_not_answered: "Offered", asked_about_it: "Buyer asked", booked: "Booked" };
const VAULT: Record<string, string> = { yes: "Yes, listing found in Vault", no: "No record found", "": "Not recorded" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--surface-soft)", borderRadius: 10, padding: "10px 14px" }}>
      <div className="soft" style={{ fontSize: 12 }}>{label}</div>
      <div style={{ fontWeight: 500, marginTop: 2 }}>{children}</div>
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
  const revealed = sp.reveal === "1" && canRevealPii(ctx.session.role);
  if (revealed) await audit(ctx.session.email, "PII reveal", `Viewed contact details for a buyer conversation (${c.conversationId.slice(0, 24)})`, ctx.branch.company_id, ctx.branch.id);

  return (
    <>
      <div><Link className="btn sm" href={`/buyer?day=${backDay}`}>Back to {backDay === "all" ? "All Data" : dayLabel(backDay)}</Link></div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{c.buyer || "Unknown buyer"} <span className="soft" style={{ fontSize: 14, fontWeight: 400 }}>· {c.property}</span></h1>
        <Badge tone={tone(c.temperature)}>{c.temperature}</Badge>
      </div>
      {res.note && <Notice>{res.note}</Notice>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 10 }}>
        <Field label="Phone">{revealed ? c.phone : mask(c.phone) || "Not captured"}</Field>
        <Field label="Email">{revealed ? c.email : mask(c.email, 6) || "Not captured"}</Field>
        <Field label="Buyer type">{c.temperature}</Field>
        <Field label="Property record in Vault">{VAULT[c.hadPropertyRecord] ?? c.hadPropertyRecord}</Field>
        <Field label="Source">{c.source || "Not captured"}</Field>
        <Field label="Inspection">{INSP[c.inspection] ?? c.inspection}</Field>
        <Field label="Handled by">
          {c.readyForAgent ? <>{c.agent || "Agent not named"}{c.agentEmail && <div className="soft" style={{ fontSize: 13, fontWeight: 400 }}>{c.agentEmail}</div>}</> : "Not handed over yet"}
        </Field>
        {c.readyForAgent && <Field label="Why handed over">{c.whyReady || "Actionable signal"}</Field>}
      </div>
      {!revealed && (c.phone || c.email) && (
        <div>
          <Link className="btn sm" href={`/buyer/${encodeURIComponent(c.conversationId)}?day=${backDay}&reveal=1`}>Reveal phone and email</Link>{" "}
          <span className="soft" style={{ fontSize: 12 }}>Revealing is recorded in the audit log.</span>
        </div>
      )}

      <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
        {c.turns.length === 0 && <div className="soft">No messages yet.</div>}
        {c.turns.map((t, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {t.buyer && (
              <div style={{ alignSelf: "flex-start", maxWidth: "78%" }}>
                <div className="bubble" style={{ background: "var(--surface-soft)", border: "1px solid var(--border)" }}>{t.buyer}</div>
                <div className="soft" style={{ fontSize: 12, marginTop: 3 }}>Buyer · {dayLabel(sydneyDay(t.at))}, {timeLabel(t.at)}</div>
              </div>
            )}
            {t.assistant && (
              <div style={{ alignSelf: "flex-end", maxWidth: "78%" }}>
                <div className="bubble" style={{ background: "var(--brand-tint)", color: "var(--brand-ink)" }}>{t.assistant}</div>
                <div className="soft" style={{ fontSize: 12, marginTop: 3, textAlign: "right" }}>Assistant · {t.replyAt ? `${dayLabel(sydneyDay(t.replyAt))}, ${timeLabel(t.replyAt)}` : "time not recorded"}</div>
              </div>
            )}
          </div>
        ))}
        {c.readyForAgent && <div className="soft" style={{ textAlign: "center", fontSize: 12, borderTop: "1px solid var(--border)", paddingTop: 10 }}>Handed over to {c.agent || "an agent"}</div>}
      </div>
    </>
  );
}
