import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleAlerts, sampleConversations, sampleFinance, sampleListings, sampleMeta, sampleProjects } from "@/lib/data/sample";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-06T00:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("sampleConversations", () => {
  it("is deterministic for a seed and differs between seeds", () => {
    expect(sampleConversations("pen")).toEqual(sampleConversations("pen"));
    expect(sampleConversations("pen")).not.toEqual(sampleConversations("bm"));
  });

  it("returns the requested number with unique ids carrying the seed", () => {
    const rows = sampleConversations("pen", 15);
    expect(rows).toHaveLength(15);
    expect(new Set(rows.map((c) => c.conversationId)).size).toBe(15);
    expect(rows.every((c) => c.conversationId.startsWith("sample-pen-"))).toBe(true);
    expect(sampleConversations("pen")).toHaveLength(40);
  });

  it("contains no real people: invented names, reserved example domain, dummy phone", () => {
    for (const c of sampleConversations("pen", 60)) {
      expect(c.buyer).toMatch(/^Sample Buyer \d{2}$/);
      expect(c.email).toBe("sample@example.test");
      expect(c.phone).toBe("0400 000 000");
      expect(c.agent === "" || /^Sample Agent [ABC]$/.test(c.agent)).toBe(true);
    }
  });

  it("is internally consistent", () => {
    for (const c of sampleConversations("pen", 60)) {
      expect(["Hot", "Warm", "New"]).toContain(c.temperature);
      expect(c.turns.length).toBe(c.temperature === "New" ? 1 : 2);
      if (c.temperature === "New") expect(c.inspection).toBe("not_discussed");
      if (!c.readyForAgent) expect(c.agent).toBe("");
      expect(c.property).toMatch(/^\d+ \w+ (St|Rd|Ave|Cres), [A-Z ]+$/);
      expect(new Date(c.lastAt).getTime()).toBeGreaterThan(new Date(c.startedAt).getTime());
      expect(new Date(c.startedAt).getTime()).toBeLessThanOrEqual(Date.now());
    }
  });
});

describe("other generators", () => {
  it("sampleListings: deterministic, labelled sample, plausible", () => {
    const a = sampleListings("pen");
    expect(a).toEqual(sampleListings("pen"));
    expect(a).toHaveLength(12);
    for (const l of a) {
      expect(l.id).toMatch(/^sample-l\d+$/);
      expect(l.bed).toBeGreaterThanOrEqual(1);
      expect(l.lat).toBeNull();
    }
    expect(sampleListings("pen", 3)).toHaveLength(3);
  });

  it("sampleProjects: invented names, consistent unit maths", () => {
    const p = sampleProjects("pen");
    expect(p.map((x) => x.name)).toEqual(["Test Gardens", "Test Court", "Test Heights"]);
    for (const x of p) expect(x.available + x.sold).toBe(x.total);
    expect(sampleProjects("pen")).toEqual(p);
  });

  it("sampleMeta: eight weeks in range", () => {
    const m = sampleMeta("pen");
    expect(m).toHaveLength(8);
    expect(m[0].week).toBe("Wk 33");
    for (const w of m) {
      expect(w.leads).toBeGreaterThanOrEqual(28);
      expect(w.leads).toBeLessThanOrEqual(72);
    }
  });

  it("sampleFinance: six months May to Oct", () => {
    const f = sampleFinance("pen");
    expect(f.map((x) => x.month)).toEqual(["May", "Jun", "Jul", "Aug", "Sep", "Oct"]);
    expect(sampleFinance("pen")).toEqual(f);
    expect(sampleFinance("bm")).not.toEqual(f);
  });

  it("sampleAlerts: fixed examples with all severities", () => {
    const a = sampleAlerts();
    expect(a.map((x) => x.severity).sort()).toEqual(["high", "low", "med", "med"]);
    expect(new Set(a.map((x) => x.key)).size).toBe(a.length);
  });
});
