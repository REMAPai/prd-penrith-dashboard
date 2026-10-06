import { describe, expect, it, vi } from "vitest";
import { convo, turn } from "@tests/helpers/conversation";
import { getConversations, mask, qualityFlags } from "@/lib/data/conversations";

const configure = () => {
  vi.stubEnv("CONVERSATIONS_WEBHOOK_EMAIL", "ops@example.test");
  vi.stubEnv("CONVERSATIONS_WEBHOOK_KEY", "pass phrase");
  vi.stubEnv("N8N_BASE_URL", "https://n8n.test/");
};
const reply = (body: unknown, ok = true, status = 200) => vi.stubGlobal("fetch", vi.fn(async () => ({ ok, status, json: async () => body })));
const payload = { generatedAt: "2026-10-06T00:00:00Z", sendingLive: false, totalConversations: 1, conversations: [convo({ conversationId: "live-1" })] };

describe("getConversations", () => {
  it("is live for the Penrith branch when configured and the log answers", async () => {
    configure();
    reply(payload);
    const r = await getConversations("pen");
    expect(r).toMatchObject({ status: "live", asOf: payload.generatedAt, sendingLive: false });
    expect(r.data.map((c) => c.conversationId)).toEqual(["live-1"]);
    const url = new URL(String(vi.mocked(fetch).mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe("https://n8n.test/webhook/prd-buyer-conversations");
    expect(url.searchParams.get("email")).toBe("ops@example.test");
    expect(url.searchParams.get("key")).toBe("pass phrase");
  });

  it("prefers an explicit webhook URL", async () => {
    configure();
    vi.stubEnv("CONVERSATIONS_WEBHOOK_URL", "https://hooks.test/convos");
    reply(payload);
    await getConversations("pen");
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toMatch(/^https:\/\/hooks\.test\/convos\?/);
  });

  it("is waiting with a sample fallback and a note when the log returns an error", async () => {
    configure();
    reply({}, false, 500);
    const r = await getConversations("pen");
    expect(r.status).toBe("waiting");
    expect(r.note).toContain("n8n returned 500");
    expect(r.data[0].conversationId).toMatch(/^sample-pen-/);
  });

  it("is waiting when the payload is wrong (bad passphrase) or the request throws", async () => {
    configure();
    reply({ message: "unauthorised" });
    expect((await getConversations("pen")).note).toContain("Unexpected payload");
    vi.stubGlobal("fetch", vi.fn(async () => { throw "weird"; }));
    expect((await getConversations("pen")).note).toContain("error");
  });

  it("is sample with a how-to-connect note for Penrith when not configured", async () => {
    const r = await getConversations("pen");
    expect(r.status).toBe("sample");
    expect(r.note).toContain("CONVERSATIONS_WEBHOOK_EMAIL");
    expect(r.data[0].conversationId).toMatch(/^sample-pen-/);
  });

  it("is always sample for other branches, even when configured, and never calls the log", async () => {
    configure();
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    const r = await getConversations("bm");
    expect(r.status).toBe("sample");
    expect(r.note).toBeUndefined();
    expect(r.data.every((c) => c.conversationId.startsWith("sample-bm-"))).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("qualityFlags", () => {
  const kinds = (c: ReturnType<typeof convo>[]) => qualityFlags(c).map((f) => f.kind);

  it("returns nothing for a clean conversation", () => {
    expect(qualityFlags([convo()])).toEqual([]);
  });

  it.each(["Postcode: 2148", "2148", "postcode 2750", " $2148. ", "POSTCODE:2148"])("flags %j as a postcode read as a message", (text) => {
    expect(kinds([convo({}, [turn(text, "Thanks!")])])).toContain("Postcode read as a message");
  });

  it.each(["I have a budget of 2148 dollars", "Is it 4 bedrooms?", "Postcode: 2148 please", "12345"])("does not flag %j as a postcode", (text) => {
    expect(kinds([convo({}, [turn(text, "Ok")])])).not.toContain("Postcode read as a message");
  });

  it("flags a buyer message with no reply", () => {
    expect(kinds([convo({}, [turn("Hello?", "")])])).toContain("Buyer message with no reply");
  });

  it("does not flag an assistant-only turn", () => {
    expect(kinds([convo({}, [turn("", "Welcome")])])).toEqual([]);
  });

  it.each(["What type of property are you looking for?", "How many bedrooms do you need?", "What is your ideal number of bedrooms?"])("flags preference question %j", (q) => {
    expect(kinds([convo({}, [turn("Hi", q)])])).toContain("Preference question asked");
  });

  it("flags three replies that start identically (repeated opening)", () => {
    const same = "Thanks for your enquiry about this property, I can help with that today.";
    const c = convo({}, [turn("a", same + " A"), turn("b", same + " B"), turn("c", same + " C")]);
    expect(kinds([c])).toContain("Repeated reply opening");
  });

  it("does not flag replies with different openings", () => {
    const c = convo({}, [turn("a", "Yes it is available."), turn("b", "Open home is Saturday."), turn("c", "I have noted that for the agent.")]);
    expect(kinds([c])).not.toContain("Repeated reply opening");
  });

  it("reports the conversation id and the buyer as the example", () => {
    const f = qualityFlags([convo({ conversationId: "abc", buyer: "Buyer X" }, [turn("Postcode: 2148", "ok")])]);
    expect(f).toEqual([{ id: "abc", kind: "Postcode read as a message", example: "Buyer X" }]);
  });

  it("flags across many conversations independently", () => {
    const a = convo({ conversationId: "a" }, [turn("2148", "ok")]);
    const b = convo({ conversationId: "b" }, [turn("hi", "How many bedrooms?")]);
    expect(qualityFlags([a, b]).map((f) => f.id)).toEqual(["a", "b"]);
  });
});

describe("mask", () => {
  it("masks all but the last characters", () => {
    expect(mask("0400111222")).toBe("•••••••222");
    expect(mask("buyer@example.test", 6)).toBe("••••••••••••e.test");
  });

  it("never reveals more than `keep` characters", () => {
    const m = mask("0400111222", 3);
    expect(m.replace(/•/g, "")).toBe("222");
    expect(m).toHaveLength(10);
  });

  it("handles short and empty strings", () => {
    expect(mask("")).toBe("");
    expect(mask("ab")).toBe("ab");
    expect(mask("abc")).toBe("abc");
  });
});
