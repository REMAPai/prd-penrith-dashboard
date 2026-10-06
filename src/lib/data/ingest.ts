import { z } from "zod";

const str = z.string().max(4000).default("");

export const claimSchema = z.object({
  conversationId: z.string().min(1).max(200),
  message: z.string().max(4000).default(""),
});

export const turnSchema = z.object({
  conversationId: z.string().min(1).max(200),
  enquiryId: str,
  buyer: str,
  phone: str,
  email: str,
  property: str,
  source: str,
  agent: str,
  temperature: z.enum(["Hot", "Warm", "New"]).default("New"),
  buyerType: str,
  financeStatus: str,
  needsToSellFirst: str,
  timeframe: str,
  inspection: z.string().max(40).default("not_discussed"),
  wantsContract: z.boolean().default(false),
  consent: str,
  readyForAgent: z.boolean().default(false),
  whyReady: str,
  handoffStatus: z.enum(["none", "pending", "done"]).default("none"),
  slaDueAt: z.string().datetime({ offset: true }).nullable().default(null),
  afterHours: z.boolean().default(false),
  blocked: str,
  turn: z.number().int().min(1).max(500),
  buyerMessage: str,
  assistantReply: str,
  buyerAt: z.string().datetime({ offset: true }),
  replyAt: z.string().datetime({ offset: true }).nullable().default(null),
});

export type TurnInput = z.infer<typeof turnSchema>;

export const CLAIM_WINDOW_MINUTES = 10;

export function msgHash(message: string): string {
  const s = message.trim().toLowerCase().replace(/\s+/g, " ");
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
