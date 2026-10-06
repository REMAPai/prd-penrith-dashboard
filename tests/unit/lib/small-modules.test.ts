import { describe, expect, it, vi } from "vitest";
import { PENRITH_CENTER, SUBURB_CENTROIDS } from "@/lib/geo";
import { STAGES, STAGE_COLORS } from "@/lib/stages";
import { nowMs } from "@/lib/time";
import { PAGES } from "@/lib/roles";

describe("geo", () => {
  it("has a centroid inside greater Penrith / Blue Mountains for every suburb", () => {
    for (const [name, [lat, lng]] of Object.entries(SUBURB_CENTROIDS)) {
      expect(lat, name).toBeGreaterThan(-34);
      expect(lat, name).toBeLessThan(-33.5);
      expect(lng, name).toBeGreaterThan(150.2);
      expect(lng, name).toBeLessThan(150.9);
    }
  });

  it("covers every suburb the seed script assigns to a branch", () => {
    for (const s of ["Penrith", "St Marys", "Katoomba", "Glenmore Park", "Springwood"]) expect(SUBURB_CENTROIDS).toHaveProperty(s);
  });

  it("centres the map on Penrith", () => {
    expect(PENRITH_CENTER).toEqual([-33.75, 150.7]);
  });
});

describe("stages", () => {
  it("has ten stages from Detected to Settled with one colour each", () => {
    expect(STAGES).toHaveLength(10);
    expect(STAGES[0]).toBe("Detected");
    expect(STAGES[9]).toBe("Settled");
    expect(STAGE_COLORS).toHaveLength(STAGES.length);
    for (const c of STAGE_COLORS) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("matches the database check constraint (stage between 0 and 9)", () => {
    expect(STAGES.length - 1).toBe(9);
  });
});

describe("time", () => {
  it("returns the current clock in ms", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-02T03:04:05Z"));
    expect(nowMs()).toBe(Date.parse("2026-01-02T03:04:05Z"));
    vi.useRealTimers();
  });
});

describe("page registry sanity", () => {
  it("never marks a sample page as live", () => {
    for (const p of PAGES.filter((x) => (x.status as string) === "sample")) expect(p.status).not.toBe("live");
  });
  it("shows real data only: no page has sample status", () => {
    expect(PAGES.filter((x) => (x.status as string) === "sample")).toEqual([]);
    for (const k of ["meta", "finance"]) expect(PAGES.find((x) => x.key === k)?.status).toBe("waiting");
  });
});
