import type { Conversation, Turn } from "@/lib/data/types";

// A day runs midnight to midnight in Sydney, matching how the team talks about "today".
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit" });

export const sydneyDay = (iso: string): string => dayFmt.format(new Date(iso));

export const dayLabel = (day: string): string =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-AU", { timeZone: "UTC", day: "numeric", month: "short" });

export const timeLabel = (iso: string): string =>
  new Date(iso).toLocaleTimeString("en-AU", { timeZone: "Australia/Sydney", hour: "numeric", minute: "2-digit" });

const turnDays = (c: Conversation): string[] => [...new Set(c.turns.map((t) => sydneyDay(t.at)))];

/** Every day that has at least one buyer message, newest first. */
export function conversationDays(convos: Conversation[]): string[] {
  return [...new Set(convos.flatMap(turnDays))].sort().reverse();
}

export const turnsOnDay = (c: Conversation, day: string): Turn[] => c.turns.filter((t) => sydneyDay(t.at) === day);

/** Conversations with a buyer message on that day, ordered by their first message that day, oldest first. */
export function conversationsOnDay(convos: Conversation[], day: string): { c: Conversation; first: string }[] {
  return convos
    .map((c) => ({ c, first: turnsOnDay(c, day)[0]?.at ?? "" }))
    .filter((x) => x.first)
    .sort((a, b) => a.first.localeCompare(b.first));
}

export const MAX_DAY_TABS = 10;

/** The newest days get their own tab; the rest go in an "Older days" menu. The open day always keeps a tab. */
export function splitDays(days: string[], current: string, max = MAX_DAY_TABS): { shown: string[]; older: string[] } {
  const shown = days.slice(0, max);
  const older = days.slice(max);
  if (older.includes(current)) return { shown: [...shown, current], older: older.filter((d) => d !== current) };
  return { shown, older };
}
