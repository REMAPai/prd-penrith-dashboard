import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { pool, poolClient } from "@tests/helpers/db";

vi.mock("@/lib/db", async () => (await import("@tests/helpers/db")).dbMock);

import { POST } from "@/app/api/ingest/[kind]/route";

const KEY = "k".repeat(32);
const post = (kind: string, body: unknown, headers: Record<string, string> = { "x-ingest-key": KEY }, raw?: string) =>
  POST(new NextRequest(`http://localhost:3100/api/ingest/${kind}`, { method: "POST", headers, body: raw ?? JSON.stringify(body) }), { params: Promise.resolve({ kind }) });
const claim = { conversationId: "c-1", message: "Is it available?" };
const turn = { conversationId: "c-1", turn: 1, buyerAt: "2026-10-01T01:00:00+10:00", buyerMessage: "Hi", assistantReply: "Hello" };
const configured = () => vi.stubEnv("INGEST_API_KEY", KEY);

describe("ingest route: authentication", () => {
  it("is 503 when no key is configured (so it can never be open by accident)", async () => {
    const r = await post("claim", claim);
    expect(r.status).toBe(503);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("is 401 with a missing, wrong or different-length key", async () => {
    configured();
    const cases: Record<string, string>[] = [{}, { "x-ingest-key": "wrong" }, { "x-ingest-key": "k".repeat(31) + "x" }, { "x-ingest-key": KEY + "x" }];
    for (const headers of cases) {
      expect((await post("claim", claim, headers)).status).toBe(401);
    }
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("rejects a configured key shorter than 24 characters as unusable", async () => {
    vi.stubEnv("INGEST_API_KEY", "short");
    expect((await post("claim", claim, { "x-ingest-key": "short" })).status).toBe(401);
  });
});

describe("ingest route: input handling", () => {
  it("is 400 for invalid JSON and for bodies that fail validation", async () => {
    configured();
    expect((await post("claim", null, undefined, "{nope")).status).toBe(400);
    expect((await post("claim", { conversationId: "" })).status).toBe(400);
    expect((await post("turn", { conversationId: "c", turn: 0 })).status).toBe(400);
  });

  it("is 404 for an unknown kind", async () => {
    configured();
    expect((await post("anything", {})).status).toBe(404);
  });
});

describe("ingest route: claim (idempotency)", () => {
  it("claims the first time a message is seen and records its hash", async () => {
    configured();
    const r = await post("claim", claim);
    expect(await r.json()).toEqual({ claimed: true });
    const inserted = pool.query.mock.calls.find((c) => /insert into buyer_claims/.test(String(c[0])))!;
    expect(inserted[1]).toEqual(["c-1", expect.stringMatching(/^[0-9a-z]+$/)]);
  });

  it("refuses a second claim for the same conversation and message inside the window", async () => {
    configured();
    pool.query.mockResolvedValueOnce({ rows: [{}], rowCount: 1 });
    const r = await post("claim", claim);
    expect(await r.json()).toEqual({ claimed: false });
    expect(pool.query.mock.calls.some((c) => /insert into/.test(String(c[0])))).toBe(false);
    const [sql, params] = pool.query.mock.calls[0];
    expect(String(sql)).toContain("conversation_id = $1 and msg_hash = $2");
    expect(params).toEqual(["c-1", expect.any(String), "10"]);
  });

  it("treats the same text differing only in case or spacing as the same message", async () => {
    configured();
    await post("claim", { ...claim, message: "Is it   AVAILABLE?" });
    await post("claim", claim);
    const hashes = pool.query.mock.calls.filter((c) => /insert into buyer_claims/.test(String(c[0]))).map((c) => c[1]![1]);
    expect(new Set(hashes).size).toBe(1);
  });

  it("purges claims older than two days", async () => {
    configured();
    await post("claim", claim);
    expect(pool.query.mock.calls.some((c) => /delete from buyer_claims where created_at < now\(\) - interval '2 days'/.test(String(c[0])))).toBe(true);
  });
});

describe("ingest route: turn", () => {
  it("upserts the conversation and the turn in one transaction", async () => {
    configured();
    const r = await post("turn", turn);
    expect(await r.json()).toEqual({ ok: true });
    const sql = poolClient.query.mock.calls.map((c) => String(c[0]).trim().split(/\s+/)[0]);
    expect(sql).toEqual(["begin", "insert", "insert", "commit"]);
    expect(poolClient.release).toHaveBeenCalled();
    const convo = poolClient.query.mock.calls[1];
    expect(String(convo[0])).toContain("on conflict (conversation_id) do update");
    expect(convo[1]![0]).toBe("c-1");
    expect(String(poolClient.query.mock.calls[2][0])).toContain("on conflict (conversation_id, turn) do update");
  });

  it("never lets a re-sent turn re-open a finished handoff", async () => {
    configured();
    await post("turn", turn);
    expect(String(poolClient.query.mock.calls[1][0])).toContain("case when buyer_conversations.handoff_status = 'done' then 'done'");
  });

  it("rolls back, releases the connection and returns 500 without leaking the error", async () => {
    configured();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    poolClient.query.mockImplementation(async (sql: string) => {
      if (/insert into buyer_conversations/.test(sql)) throw new Error("password authentication failed for user secret_user");
      return { rows: [], rowCount: 0 };
    });
    const r = await post("turn", turn);
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain("secret_user");
    expect(poolClient.query.mock.calls.map((c) => String(c[0]))).toContain("rollback");
    expect(poolClient.release).toHaveBeenCalled();
    expect(err).toHaveBeenCalled();
  });
});
