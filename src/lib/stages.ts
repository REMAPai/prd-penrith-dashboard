export const STAGES = ["Detected", "Qualified", "Owner traced", "Approached", "Negotiation", "Acquired", "DA approved", "Marketing", "Selling", "Settled"];

export type Site = {
  id: number; address: string; suburb: string; zoning: string; zoning_confirmed: boolean; lot_size: string | null; stage: number; priority: string | null;
  signal: string | null; da_number: string | null; da_type: string | null; da_status: string | null; source: string | null; assignee: string | null;
  next_step: string | null; notes: string | null; is_sample: boolean; identified_on: string; stage_changed_at: string; lat: number | null; lng: number | null;
  lga: string | null; applicant: string | null; abn: string | null; contact_found: string | null; ownership_signal: string | null;
  hold_years: number | null; fsr: string | null; height_m: string | null; zoning_source: string | null;
  site_kind: "da" | "listing" | null; price_guide: string | null; recency_label: string | null;
  action_taken: string | null; zone_code: string | null; zone_name: string | null;
};

export const STAGE_COLORS = ["#8a8f9c", "#e8a100", "#6c5ce7", "#2f80ed", "#e41e26", "#b3141b", "#1f9d6b", "#12a3b4", "#0b7285", "#136b49"];
