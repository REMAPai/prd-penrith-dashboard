import { z } from "zod";

/** Council name in the sheet to the dashboard branch that owns it. */
export const COUNCIL_BRANCH = { Penrith: "pen", "Blue Mountains": "bm" } as const;

const text = (max = 500) => z.string().max(max).default("");
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** One row of the DA & CDC Tracker tab, plus run details the workflow knows (flag, zone code). */
export const playbookRowSchema = z.object({
  council: z.enum(["Penrith", "Blue Mountains"]),
  applicationNo: z.string().trim().min(1).max(60),
  type: z.enum(["DA", "CDC"]),
  dateIdentified: day.nullable().default(null),
  address: text(300),
  suburb: text(100),
  zoning: text(40),
  zoningSource: text(120),
  zoneCode: text(20),
  zoneName: text(120),
  status: text(40),
  applicant: text(300),
  sourcePortal: text(120),
  acnAbn: text(60),
  contactFound: text(60),
  actionTaken: text(60),
  notes: text(4000),
  flag: text(120),
});

/** One row of the Director & Company Lookup tab. */
export const playbookCompanySchema = z.object({
  name: z.string().trim().min(1).max(300),
  linkedAddress: text(300),
  acnAbn: text(60),
  asicDone: text(40),
  directors: text(1000),
  role: text(200),
  contact: text(500),
  sourceUsed: text(120),
  notes: text(2000),
});

export const playbookSchema = z.object({
  weekStart: day.refine((d) => new Date(`${d}T00:00:00Z`).getUTCDay() === 1, "weekStart must be a Monday"),
  runAt: z.string().datetime({ offset: true }),
  rows: z.array(playbookRowSchema).max(3000),
  companies: z.array(playbookCompanySchema).max(2000).default([]),
});

export type PlaybookRow = z.infer<typeof playbookRowSchema>;
export type PlaybookPayload = z.infer<typeof playbookSchema>;

const addDays = (iso: string, n: number) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * 86400000);
// Fixed month names: Intl abbreviates September as "Sep" or "Sept" depending on the Node version.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const short = (d: Date) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;

/** "5 Oct to 11 Oct 2026" for a week that starts on the given Monday. */
export function weekLabel(weekStart: string): string {
  const end = addDays(weekStart, 6);
  return `${short(addDays(weekStart, 0))} to ${short(end)} ${end.getUTCFullYear()}`;
}

/** Inclusive Sunday that ends the week, as YYYY-MM-DD. */
export const weekEnd = (weekStart: string) => addDays(weekStart, 6).toISOString().slice(0, 10);

/**
 * The Weekly Snapshot formulas in the sheet count rows whose Date Identified falls between (week ending minus 7 days) and the week ending,
 * inclusive. This repeats that rule so the app agrees with the sheet.
 */
export function inSheetWeek(identified: string | null | undefined, weekStart: string): boolean {
  if (!identified) return false;
  const d = identified.slice(0, 10);
  const end = weekEnd(weekStart);
  const from = addDays(end, -7).toISOString().slice(0, 10);
  return d >= from && d <= end;
}
