import type { Conversation, Turn } from "@/lib/data/types";

export const turn = (buyer: string, assistant: string, at = "2026-10-01T01:00:00.000Z"): Turn => ({ at, buyer, assistant });

export function convo(over: Partial<Conversation> = {}, turns: Turn[] = [turn("Is this still available?", "Yes, it is. Open home Saturday.")]): Conversation {
  return {
    conversationId: "c-1",
    buyer: "Test Buyer",
    phone: "0400111222",
    email: "buyer@example.test",
    property: "12 Test St, PENRITH",
    source: "REA",
    agent: "",
    temperature: "New",
    buyerType: "",
    financeStatus: "",
    needsToSellFirst: "",
    timeframe: "",
    inspection: "not_discussed",
    wantsContract: false,
    consent: "",
    readyForAgent: false,
    whyReady: "",
    afterHours: false,
    startedAt: "2026-10-01T01:00:00.000Z",
    lastAt: "2026-10-01T01:10:00.000Z",
    date: "2026-10-01",
    turns,
    ...over,
  };
}
