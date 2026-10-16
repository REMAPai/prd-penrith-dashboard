import type { Conversation } from "@/lib/data/types";

export type BuyerFilters = { q: string };

/** Plain-text search over the fields a person would type: buyer, property, source and agent. */
export function matchesSearch(c: Conversation, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [c.buyer, c.property, c.source, c.agent].some((v) => v.toLowerCase().includes(needle));
}

export function applyFilters<T extends { c: Conversation }>(rows: T[], f: BuyerFilters): T[] {
  return rows.filter(({ c }) => matchesSearch(c, f.q));
}
