import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { pool } from "@/lib/db";
import { CLAIM_WINDOW_MINUTES, claimSchema, msgHash, turnSchema } from "@/lib/data/ingest";

export const dynamic = "force-dynamic";

function authorised(req: NextRequest): boolean {
  const expected = process.env.INGEST_API_KEY;
  const given = req.headers.get("x-ingest-key") ?? "";
  if (!expected || expected.length < 24) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ kind: string }> }) {
  if (!process.env.INGEST_API_KEY) return NextResponse.json({ error: "ingest not configured" }, { status: 503 });
  if (!authorised(req)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const { kind } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (kind === "claim") {
    const p = claimSchema.safeParse(body);
    if (!p.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
    const hash = msgHash(p.data.message);
    const dup = await pool.query(
      `select 1 from buyer_claims where conversation_id = $1 and msg_hash = $2 and created_at > now() - ($3 || ' minutes')::interval limit 1`,
      [p.data.conversationId, hash, String(CLAIM_WINDOW_MINUTES)],
    );
    if (dup.rowCount) return NextResponse.json({ claimed: false });
    await pool.query(`insert into buyer_claims (conversation_id, msg_hash) values ($1, $2)`, [p.data.conversationId, hash]);
    await pool.query(`delete from buyer_claims where created_at < now() - interval '2 days'`);
    return NextResponse.json({ claimed: true });
  }

  if (kind === "turn") {
    const p = turnSchema.safeParse(body);
    if (!p.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
    const t = p.data;
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(
        `insert into buyer_conversations (conversation_id, enquiry_id, buyer, phone, email, property, source, agent, temperature, buyer_type, finance_status, needs_to_sell_first, timeframe, inspection, wants_contract, consent, ready_for_agent, why_ready, handoff_status, sla_due_at, after_hours, blocked, started_at, last_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$23)
         on conflict (conversation_id) do update set
           buyer = excluded.buyer, phone = excluded.phone, email = excluded.email, property = excluded.property, agent = excluded.agent,
           temperature = excluded.temperature, buyer_type = excluded.buyer_type, finance_status = excluded.finance_status,
           needs_to_sell_first = excluded.needs_to_sell_first, timeframe = excluded.timeframe, inspection = excluded.inspection,
           wants_contract = excluded.wants_contract, consent = excluded.consent, ready_for_agent = excluded.ready_for_agent,
           why_ready = excluded.why_ready, sla_due_at = excluded.sla_due_at, blocked = excluded.blocked, last_at = excluded.last_at,
           handoff_status = case when buyer_conversations.handoff_status = 'done' then 'done' else excluded.handoff_status end`,
        [t.conversationId, t.enquiryId, t.buyer, t.phone, t.email, t.property, t.source, t.agent, t.temperature, t.buyerType, t.financeStatus, t.needsToSellFirst, t.timeframe, t.inspection, t.wantsContract, t.consent, t.readyForAgent, t.whyReady, t.handoffStatus, t.slaDueAt, t.afterHours, t.blocked, t.buyerAt],
      );
      await client.query(
        `insert into buyer_turns (conversation_id, turn, buyer_message, assistant_reply, buyer_at, reply_at)
         values ($1,$2,$3,$4,$5,$6)
         on conflict (conversation_id, turn) do update set buyer_message = excluded.buyer_message, assistant_reply = excluded.assistant_reply, reply_at = excluded.reply_at`,
        [t.conversationId, t.turn, t.buyerMessage, t.assistantReply, t.buyerAt, t.replyAt],
      );
      await client.query("commit");
    } catch (e) {
      await client.query("rollback");
      console.error("ingest turn failed", e instanceof Error ? e.message : "error");
      return NextResponse.json({ error: "store failed" }, { status: 500 });
    } finally {
      client.release();
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "not found" }, { status: 404 });
}
