import "server-only";
import type { Conversation, Result } from "./types";
import { sampleConversations } from "./sample";

type Payload = { generatedAt: string; sendingLive: boolean; totalConversations: number; conversations: Conversation[] };

const url = () => (process.env.CONVERSATIONS_WEBHOOK_URL || `${(process.env.N8N_BASE_URL || "").replace(/\/$/, "")}/webhook/prd-buyer-conversations`);
const configured = () => !!process.env.CONVERSATIONS_WEBHOOK_EMAIL && !!process.env.CONVERSATIONS_WEBHOOK_KEY && !!process.env.N8N_BASE_URL;

async function fetchLive(): Promise<Payload> {
  const u = new URL(url());
  u.searchParams.set("email", process.env.CONVERSATIONS_WEBHOOK_EMAIL!);
  u.searchParams.set("key", process.env.CONVERSATIONS_WEBHOOK_KEY!);
  const res = await fetch(u, { next: { revalidate: 60 }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`n8n returned ${res.status}`);
  const j = (await res.json()) as Payload;
  if (!j || !Array.isArray(j.conversations)) throw new Error("Unexpected payload (check the passphrase)");
  return j;
}

export async function getConversations(branchId: string): Promise<Result<Conversation[]> & { sendingLive?: boolean }> {
  if (branchId === "pen" && configured()) {
    try {
      const j = await fetchLive();
      return { status: "live", data: j.conversations, source: "n8n conversation log (Google Sheet)", asOf: j.generatedAt, sendingLive: j.sendingLive };
    } catch (e) {
      return { status: "waiting", data: sampleConversations(branchId), source: "n8n conversation log", note: `Could not read the live log: ${e instanceof Error ? e.message : "error"}. Showing sample data.` };
    }
  }
  return {
    status: "sample",
    data: sampleConversations(branchId),
    source: "Sample generator",
    note: branchId === "pen" ? "Add CONVERSATIONS_WEBHOOK_EMAIL and CONVERSATIONS_WEBHOOK_KEY to connect the live conversation log." : undefined,
  };
}

export type QualityFlag = { id: string; kind: string; example: string };

export function qualityFlags(convos: Conversation[]): QualityFlag[] {
  const out: QualityFlag[] = [];
  for (const c of convos) {
    const replies = c.turns.map((t) => t.assistant).filter(Boolean);
    if (replies.length > 1 && new Set(replies.map((r) => r.slice(0, 60))).size < replies.length - 1)
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
