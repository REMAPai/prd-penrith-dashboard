import type { Status } from "../roles";

export type Result<T> = { status: Status; data: T; source: string; note?: string; asOf?: string };

export type Turn = { at: string; buyer: string; assistant: string };

export type Conversation = {
  conversationId: string;
  buyer: string;
  phone: string;
  email: string;
  property: string;
  source: string;
  agent: string;
  temperature: "Hot" | "Warm" | "New";
  buyerType: string;
  financeStatus: string;
  needsToSellFirst: string;
  timeframe: string;
  inspection: string;
  wantsContract: boolean;
  consent: string;
  readyForAgent: boolean;
  whyReady: string;
  afterHours: boolean;
  startedAt: string;
  lastAt: string;
  date: string | null;
  turns: Turn[];
};

export type Listing = {
  id: string;
  address: string;
  suburb: string;
  type: string;
  bed: number | null;
  bath: number | null;
  cars: number | null;
  price: string;
  lat: number | null;
  lng: number | null;
  modified: string;
  enquiries30: number;
  hot: number;
  agent?: string;
};

export type Project = { name: string; suburb: string; total: number; available: number; sold: number; valueM: number; band: string; enquiries: number };
export type MetaWeek = { week: string; leads: number; hoursToFirst: number; inVault: number; dropPct: number };
export type FinanceMonth = { month: string; revenue: number; expenses: number };
export type AlertRow = { key: string; severity: "high" | "med" | "low"; source: string; message: string; age: string };
