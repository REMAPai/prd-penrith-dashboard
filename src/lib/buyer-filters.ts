import type { Conversation } from "@/lib/data/types";

export type BuyerStatus = "all" | "handed" | "replying";
export type BuyerFilters = { q: string; status?: BuyerStatus; agent?: string };

export const parseStatus = (v: string | undefined): BuyerStatus => (v === "handed" || v === "replying" ? v : "all");

export const matchesStatus = (c: Conversation, status: BuyerStatus): boolean => status === "all" || (status === "handed" ? c.readyForAgent : !c.readyForAgent);

/** Plain-text search over the fields a person would type: buyer, property, source and agent. */
export function matchesSearch(c: Conversation, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [c.buyer, c.property, c.source, c.agent].some((v) => v.toLowerCase().includes(needle));
}

export function applyFilters<T extends { c: Conversation }>(rows: T[], f: BuyerFilters): T[] {
  return rows.filter(({ c }) => matchesSearch(c, f.q) && matchesStatus(c, f.status ?? "all") && (!f.agent || c.agent === f.agent));
}

/** The agents named on these rows, for the filter dropdown. */
export const agentsOf = (rows: { c: Conversation }[]): string[] => [...new Set(rows.map(({ c }) => c.agent).filter(Boolean))].sort();
