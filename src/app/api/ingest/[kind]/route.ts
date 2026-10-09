import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { pool } from "@/lib/db";
import { CLAIM_WINDOW_MINUTES, claimSchema, msgHash, turnSchema } from "@/lib/data/ingest";
import { COUNCIL_BRANCH, playbookSchema } from "@/lib/playbook";

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

  if (kind === "playbook") {
    const p = playbookSchema.safeParse(body);
    if (!p.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
    const { weekStart, runAt, rows, companies } = p.data;
    const client = await pool.connect();
    let flagged = 0;
    try {
      await client.query("begin");

      const perBranch = new Map<string, number>();
      for (const r of rows) perBranch.set(COUNCIL_BRANCH[r.council], (perBranch.get(COUNCIL_BRANCH[r.council]) ?? 0) + 1);
      for (const [branch, total] of perBranch) {
        await client.query(
          `insert into playbook_weeks (branch_id, week_start, run_at, rows_total) values ($1,$2,$3,$4)
           on conflict (branch_id, week_start) do update set run_at = excluded.run_at, rows_total = excluded.rows_total`,
          [branch, weekStart, runAt, total],
        );
      }

      for (const r of rows) {
        const branch = COUNCIL_BRANCH[r.council];
        // The sheet is the source for these columns. Stage, assignee and stage history belong to the app and are never overwritten.
        const site = await client.query<{ id: number }>(
          `insert into pipeline_sites (branch_id, lga, da_number, da_type, address, suburb, zoning, zoning_confirmed, zoning_source, zone_code, zone_name, da_status, applicant, source, abn, contact_found, action_taken, notes, identified_on, site_kind, is_sample, stage)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,coalesce($19::date, current_date),'da',false,0)
           on conflict (branch_id, da_type, da_number) where da_number is not null and da_type is not null do update set
             lga = excluded.lga, address = excluded.address, suburb = excluded.suburb, zoning = excluded.zoning, zoning_confirmed = excluded.zoning_confirmed,
             zoning_source = coalesce(excluded.zoning_source, pipeline_sites.zoning_source), zone_code = coalesce(excluded.zone_code, pipeline_sites.zone_code), zone_name = coalesce(excluded.zone_name, pipeline_sites.zone_name), da_status = excluded.da_status,
             applicant = excluded.applicant, source = excluded.source, abn = excluded.abn, contact_found = excluded.contact_found,
             action_taken = excluded.action_taken, notes = excluded.notes, identified_on = coalesce($19::date, pipeline_sites.identified_on), updated_at = now()
           returning id`,
          [branch, r.council, r.applicationNo, r.type, r.address, r.suburb, r.zoning || "TBC", r.zoning !== "", r.zoning ? r.zoningSource : null, r.zoneCode || null, r.zoneName || null,
            r.status || null, r.applicant || null, r.sourcePortal || null, r.acnAbn || null, r.contactFound || null, r.actionTaken || null, r.notes || null, r.dateIdentified],
        );
        if (r.flag) {
          flagged += 1;
          await client.query(
            `insert into playbook_week_items (branch_id, week_start, site_id, flag, status_at_week) values ($1,$2,$3,$4,$5)
             on conflict (branch_id, week_start, site_id) do update set flag = excluded.flag, status_at_week = excluded.status_at_week`,
            [branch, weekStart, site.rows[0].id, r.flag, r.status],
          );
        }
      }

      for (const c of companies) {
        await client.query(
          `insert into playbook_companies (company_id, name, linked_address, acn_abn, asic_done, directors, role, contact_details, source_used, notes)
           values ('prd',$1,$2,$3,$4,$5,$6,$7,$8,$9)
           on conflict (company_id, name) do update set linked_address = excluded.linked_address, acn_abn = excluded.acn_abn, asic_done = excluded.asic_done,
             directors = excluded.directors, role = excluded.role, contact_details = excluded.contact_details, source_used = excluded.source_used, notes = excluded.notes, updated_at = now()`,
          [c.name, c.linkedAddress, c.acnAbn, c.asicDone, c.directors, c.role, c.contact, c.sourceUsed, c.notes],
        );
      }

      await client.query("commit");
    } catch (e) {
      await client.query("rollback");
      console.error("ingest playbook failed", e instanceof Error ? e.message : "error");
      return NextResponse.json({ error: "store failed" }, { status: 500 });
    } finally {
      client.release();
    }
    return NextResponse.json({ ok: true, rows: rows.length, flagged, companies: companies.length });
  }

  return NextResponse.json({ error: "not found" }, { status: 404 });
}
