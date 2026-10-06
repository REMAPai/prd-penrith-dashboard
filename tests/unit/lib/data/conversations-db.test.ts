import { describe, expect, it, vi } from "vitest";
import { query, routeDb } from "@tests/helpers/db";

vi.mock("@/lib/db", async () => (await import("@tests/helpers/db")).dbMock);

import { getConversations } from "@/lib/data/conversations";

const row = (over: Record<string, unknown> = {}) => ({
  conversation_id: "db-1", enquiry_id: "e1", buyer: "DB Buyer", phone: "0400", email: "b@example.test", property: "1 A St, PENRITH", source: "REA", agent: "", temperature: "Hot",
  buyer_type: "Investor", finance_status: "Pre-approved", needs_to_sell_first: "No", timeframe: "0-3 months", inspection: "booked", wants_contract: false, consent: "Yes",
  ready_for_agent: true, why_ready: "Booked", handoff_status: "pending", sla_due_at: new Date("2026-10-02T00:00:00Z"), after_hours: false,
  started_at: new Date("2026-10-01T00:00:00Z"), last_at: new Date("2026-10-01T01:00:00Z"), ...over,
});
const turns = [
  { conversation_id: "db-1", turn: 1, buyer_message: "Hi", assistant_reply: "Hello", buyer_at: new Date("2026-10-01T00:00:00Z"), reply_at: new Date("2026-10-01T00:01:00Z") },
  { conversation_id: "db-1", turn: 2, buyer_message: "Postcode: 2148", assistant_reply: "", buyer_at: new Date("2026-10-01T01:00:00Z"), reply_at: null },
];

describe("getConversations: dashboard database", () => {
  it("is live and mapped from the buyer_conversations and buyer_turns tables", async () => {
    vi.stubEnv("OUTBOUND_SENDING_LIVE", "true");
    routeDb([[/from buyer_conversations/, [row()]], [/from buyer_turns/, turns]]);
    const r = await getConversations("pen");
    expect(r).toMatchObject({ status: "live", sendingLive: true, asOf: "2026-10-01T01:00:00.000Z" });
    expect(r.source).toContain("Dashboard database");
    expect(r.data[0]).toMatchObject({
      conversationId: "db-1", buyer: "DB Buyer", buyerType: "Investor", readyForAgent: true, handoffStatus: "pending", slaDueAt: "2026-10-02T00:00:00.000Z", date: "2026-10-01",
    });
    expect(r.data[0].turns).toEqual([
      { at: "2026-10-01T00:00:00.000Z", buyer: "Hi", assistant: "Hello", replyAt: "2026-10-01T00:01:00.000Z" },
      { at: "2026-10-01T01:00:00.000Z", buyer: "Postcode: 2148", assistant: "", replyAt: null },
    ]);
  });

  it("only reads the Penrith branch and passes the conversation ids as a parameter", async () => {
    routeDb([[/from buyer_conversations/, [row()]], [/from buyer_turns/, turns]]);
    await getConversations("pen");
    expect(String(query.mock.calls[0][0])).toContain("branch_id = 'pen'");
    expect(query.mock.calls[1][1]).toEqual([["db-1"]]);
  });

  it("outbound sending is reported as held unless OUTBOUND_SENDING_LIVE is exactly 'true'", async () => {
    routeDb([[/from buyer_conversations/, [row({ sla_due_at: null })]], [/from buyer_turns/, []]]);
    expect((await getConversations("pen")).sendingLive).toBe(false);
    vi.stubEnv("OUTBOUND_SENDING_LIVE", "yes");
    expect((await getConversations("pen")).sendingLive).toBe(false);
    expect((await getConversations("pen")).data[0].slaDueAt).toBeNull();
    expect((await getConversations("pen")).data[0].turns).toEqual([]);
  });

  it("does not claim live when the table is empty: waiting with no data and a stored-yet note", async () => {
    routeDb([[/from buyer_conversations/, []]]);
    const r = await getConversations("pen");
    expect(r.status).toBe("waiting");
    expect(r.data).toEqual([]);
    expect(r.note).toMatch(/^No conversations are stored yet/);
  });

  it("is waiting with a safe note when the database errors, never leaking the error text or claiming live", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    query.mockRejectedValue(new Error("connection refused postgres://u:secret@db"));
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const r = await getConversations("pen");
    expect(r).toMatchObject({ status: "waiting", data: [], note: "Could not read the dashboard database." });
    expect(JSON.stringify(r)).not.toMatch(/refused|secret|postgres:/);
    expect(err).toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("never reads the database for other branches", async () => {
    const r = await getConversations("bm");
    expect(r.status).toBe("waiting");
    expect(r.data).toEqual([]);
    expect(r.note).toBe("Live conversations are only connected for the Penrith branch.");
    expect(query).not.toHaveBeenCalled();
  });

  it("never calls n8n: legacy webhook variables have no effect", async () => {
    vi.stubEnv("CONVERSATIONS_WEBHOOK_ENABLED", "true");
    vi.stubEnv("CONVERSATIONS_WEBHOOK_EMAIL", "e@x.test");
    vi.stubEnv("CONVERSATIONS_WEBHOOK_KEY", "k");
    vi.stubEnv("N8N_BASE_URL", "https://n8n.test");
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    routeDb([[/from buyer_conversations/, []]]);
    const r = await getConversations("pen");
    expect(r.status).toBe("waiting");
    expect(r.data).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });
});
