import { describe, expect, it } from "vitest";
import { COUNCIL_BRANCH, inSheetWeek, playbookSchema, weekEnd, weekLabel } from "@/lib/playbook";

describe("weekLabel and weekEnd", () => {
  it("labels a Monday-to-Sunday week the same way in every Node version", () => {
    expect(weekLabel("2026-10-05")).toBe("5 Oct to 11 Oct 2026");
    expect(weekLabel("2026-09-28")).toBe("28 Sep to 4 Oct 2026");
    expect(weekLabel("2026-12-28")).toBe("28 Dec to 3 Jan 2027");
  });
  it("ends the week on the Sunday", () => {
    expect(weekEnd("2026-10-05")).toBe("2026-10-11");
  });
});

describe("inSheetWeek (the Weekly Snapshot formula in the sheet)", () => {
  it("counts a Date Identified from 7 days before the week ending up to and including it", () => {
    expect(inSheetWeek("2026-10-04", "2026-10-05")).toBe(true);
    expect(inSheetWeek("2026-10-08", "2026-10-05")).toBe(true);
    expect(inSheetWeek("2026-10-11", "2026-10-05")).toBe(true);
    expect(inSheetWeek("2026-10-03", "2026-10-05")).toBe(false);
    expect(inSheetWeek("2026-10-12", "2026-10-05")).toBe(false);
  });
  it("ignores a missing date", () => {
    expect(inSheetWeek(null, "2026-10-05")).toBe(false);
    expect(inSheetWeek(undefined, "2026-10-05")).toBe(false);
  });
});

describe("playbookSchema", () => {
  const row = { council: "Penrith", applicationNo: "DA1/1", type: "DA" };
  it("fills the optional sheet columns with empty text, never invented values", () => {
    const p = playbookSchema.parse({ weekStart: "2026-10-05", runAt: "2026-10-05T07:00:00+11:00", rows: [row] });
    expect(p.rows[0]).toMatchObject({ zoning: "", applicant: "", acnAbn: "", contactFound: "", actionTaken: "", notes: "", flag: "", dateIdentified: null });
    expect(p.companies).toEqual([]);
  });
  it("maps each council to a branch", () => {
    expect(COUNCIL_BRANCH).toEqual({ Penrith: "pen", "Blue Mountains": "bm" });
  });
  it("refuses more rows than one weekly run can hold", () => {
    expect(playbookSchema.safeParse({ weekStart: "2026-10-05", runAt: "2026-10-05T07:00:00+11:00", rows: Array(3001).fill(row) }).success).toBe(false);
  });
});
