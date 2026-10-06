import { describe, expect, it } from "vitest";
import { convo, turn } from "@tests/helpers/conversation";
import { mask, qualityFlags } from "@/lib/data/conversations";

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

  it("flags exactly two identical replies", () => {
    const same = "Thanks for your enquiry, I can help with inspection times today.";
    expect(kinds([convo({}, [turn("a", same), turn("b", same)])])).toContain("Repeated reply opening");
  });

  it("flags a duplicate pair among distinct replies", () => {
    const c = convo({}, [turn("a", "Yes it is available."), turn("b", "Open home is Saturday."), turn("c", "Yes it is available.")]);
    expect(kinds([c])).toContain("Repeated reply opening");
  });

  it("does not flag a single reply or two distinct replies", () => {
    expect(kinds([convo({}, [turn("a", "Yes it is available.")])])).not.toContain("Repeated reply opening");
    expect(kinds([convo({}, [turn("a", "Yes it is available."), turn("b", "Open home is Saturday.")])])).not.toContain("Repeated reply opening");
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
