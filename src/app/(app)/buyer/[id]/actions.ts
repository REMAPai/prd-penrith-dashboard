"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { access } from "@/lib/ctx";
import { query } from "@/lib/db";
import { canMarkContacted } from "@/lib/roles";
import { audit } from "@/lib/session";

const input = z.object({ id: z.string().min(1).max(200) });

/** The agent has contacted the buyer. Only moves a buyer that is with an agent, and only in the user's branch. */
export async function markContacted(formData: FormData) {
  const ctx = await access("buyer");
  if (!ctx || ctx === "denied" || !canMarkContacted(ctx.session.role)) return;
  const p = input.safeParse({ id: formData.get("id") });
  if (!p.success) return;
  const done = await query<{ conversation_id: string }>(
    "update buyer_conversations set handoff_status = 'done' where conversation_id = $1 and branch_id = $2 and ready_for_agent and handoff_status <> 'done' returning conversation_id",
    [p.data.id, ctx.branch.id],
  );
  if (!done.length) return;
  await audit(ctx.session.email, "Buyer contacted", `Marked a buyer conversation as contacted (${p.data.id.slice(0, 24)})`, ctx.branch.company_id, ctx.branch.id);
  revalidatePath("/buyer");
  revalidatePath(`/buyer/${encodeURIComponent(p.data.id)}`);
}
