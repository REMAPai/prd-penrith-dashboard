import { describe, expect, it } from "vitest";
import { applyFilters, matchesSearch, matchesStatus, parseStatus } from "@/lib/buyer-filters";
import { convo } from "@tests/helpers/conversation";

const a = convo({ conversationId: "a", buyer: "Rachel Moore", property: "12 Lucas St, EMU PLAINS", source: "REA", agent: "Thomas Latty" });
const b = convo({ conversationId: "b", buyer: "Jared Park", property: "5 Smith Rd, PENRITH", source: "Domain", agent: "" });

describe("matchesSearch", () => {
  it("matches buyer, property, source and agent, ignoring case", () => {
    expect(matchesSearch(a, "rachel")).toBe(true);
    expect(matchesSearch(a, "lucas")).toBe(true);
    expect(matchesSearch(a, "rea")).toBe(true);
    expect(matchesSearch(a, "THOMAS")).toBe(true);
    expect(matchesSearch(a, "smith")).toBe(false);
  });
  it("an empty or blank search matches everything", () => {
    expect(matchesSearch(b, "")).toBe(true);
    expect(matchesSearch(b, "   ")).toBe(true);
  });
});

describe("applyFilters", () => {
  it("keeps only the rows that match", () => {
    const rows = [{ c: a }, { c: b }];
    expect(applyFilters(rows, { q: "penrith" }).map((r) => r.c.conversationId)).toEqual(["b"]);
    expect(applyFilters(rows, { q: "" })).toHaveLength(2);
  });
});

describe("status filter", () => {
  const handed = convo({ conversationId: "h", readyForAgent: true });
  const replying = convo({ conversationId: "r", readyForAgent: false });
  it("separates buyers handed to an agent from those the assistant is still replying to", () => {
    expect(matchesStatus(handed, "handed")).toBe(true);
    expect(matchesStatus(replying, "handed")).toBe(false);
    expect(matchesStatus(replying, "replying")).toBe(true);
    expect(matchesStatus(handed, "replying")).toBe(false);
    expect(matchesStatus(handed, "all") && matchesStatus(replying, "all")).toBe(true);
  });
  it("applies together with the search", () => {
    const rows = [{ c: handed }, { c: replying }];
    expect(applyFilters(rows, { q: "", status: "handed" }).map((r) => r.c.conversationId)).toEqual(["h"]);
    expect(applyFilters(rows, { q: "nobody", status: "handed" })).toHaveLength(0);
  });
  it("treats any unknown value as all", () => {
    expect(parseStatus("handed")).toBe("handed");
    expect(parseStatus("x")).toBe("all");
    expect(parseStatus(undefined)).toBe("all");
  });
});
