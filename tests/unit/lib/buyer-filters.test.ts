import { describe, expect, it } from "vitest";
import { applyFilters, matchesSearch } from "@/lib/buyer-filters";
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
