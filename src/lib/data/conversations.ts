import "server-only";
import type { Conversation, Result } from "./types";
import { query } from "@/lib/db";

type ConvRow = { conversation_id: string; enquiry_id: string; buyer: string; phone: string; email: string; property: string; source: string; agent: string; temperature: "Hot" | "Warm" | "New"; buyer_type: string; finance_status: string; needs_to_sell_first: string; timeframe: string; inspection: string; wants_contract: boolean; consent: string; ready_for_agent: boolean; why_ready: string; handoff_status: "none" | "pending" | "done"; sla_due_at: Date | null; after_hours: boolean; started_at: Date; last_at: Date };
type TurnRow = { conversation_id: string; turn: number; buyer_message: string; assistant_reply: string; buyer_at: Date; reply_at: Date | null };

async function fromDatabase(): Promise<{ data: Conversation[]; asOf: string } | null> {
  const convs = await query<ConvRow>("select * from buyer_conversations where branch_id = 'pen' order by last_at desc limit 500");
  if (!convs.length) return null;
  const turns = await query<TurnRow>("select * from buyer_turns where conversation_id = any($1) order by conversation_id, turn", [convs.map((c) => c.conversation_id)]);
  const byConv = new Map<string, TurnRow[]>();
  for (const t of turns) byConv.set(t.conversation_id, [...(byConv.get(t.conversation_id) ?? []), t]);
  const data: Conversation[] = convs.map((c) => ({
    conversationId: c.conversation_id,
    buyer: c.buyer, phone: c.phone, email: c.email, property: c.property, source: c.source, agent: c.agent,
    temperature: c.temperature, buyerType: c.buyer_type, financeStatus: c.finance_status, needsToSellFirst: c.needs_to_sell_first,
    timeframe: c.timeframe, inspection: c.inspection, wantsContract: c.wants_contract, consent: c.consent,
    readyForAgent: c.ready_for_agent, whyReady: c.why_ready, afterHours: c.after_hours,
    startedAt: c.started_at.toISOString(), lastAt: c.last_at.toISOString(), date: c.started_at.toISOString().slice(0, 10),
    handoffStatus: c.handoff_status, slaDueAt: c.sla_due_at ? c.sla_due_at.toISOString() : null,
    turns: (byConv.get(c.conversation_id) ?? []).map((t) => ({ at: t.buyer_at.toISOString(), buyer: t.buyer_message, assistant: t.assistant_reply, replyAt: t.reply_at ? t.reply_at.toISOString() : null })),
  }));
  return { data, asOf: convs[0].last_at.toISOString() };
}

export async function getConversations(branchId: string): Promise<Result<Conversation[]> & { sendingLive?: boolean }> {
  const sendingLive = process.env.OUTBOUND_SENDING_LIVE === "true";
  if (branchId !== "pen") return { status: "waiting", data: [], source: "Dashboard database", note: "Live conversations are only connected for the Penrith branch." };
  try {
    const db = await fromDatabase();
    if (db) return { status: "live", data: db.data, source: "Dashboard database, written by n8n on every turn", asOf: db.asOf, sendingLive };
    return { status: "waiting", data: [], source: "Dashboard database", note: "No conversations are stored yet. n8n adds each one to the dashboard database as enquiries arrive." };
  } catch (e) {
    console.error("conversation store unavailable", e instanceof Error ? e.message : "error");
    return { status: "waiting", data: [], source: "Dashboard database", note: "Could not read the dashboard database." };
  }
}

export type QualityFlag = { id: string; kind: string; example: string };

export function qualityFlags(convos: Conversation[]): QualityFlag[] {
  const out: QualityFlag[] = [];
  for (const c of convos) {
    const replies = c.turns.map((t) => t.assistant).filter(Boolean);
    if (replies.length > 1 && new Set(replies.map((r) => r.slice(0, 60))).size < replies.length)
      out.push({ id: c.conversationId, kind: "Repeated reply opening", example: c.buyer });
    for (const t of c.turns) {
      if (/^\W*(postcode\W*)?\$?\d{4}\W*$/i.test(t.buyer)) out.push({ id: c.conversationId, kind: "Postcode read as a message", example: c.buyer });
      if (t.buyer && !t.assistant) out.push({ id: c.conversationId, kind: "Buyer message with no reply", example: c.buyer });
      if (/what type of property|how many bedrooms|ideal number of bedrooms/i.test(t.assistant)) out.push({ id: c.conversationId, kind: "Preference question asked", example: c.buyer });
    }
  }
  return out;
}

export const mask = (s: string, keep = 3) => (s ? "•".repeat(Math.max(0, s.length - keep)) + s.slice(-keep) : "");
