import { beforeEach, describe, expect, it, vi } from "vitest";
import { callsMatching, query, routeDb } from "@tests/helpers/db";
import { nextCacheMock } from "@tests/helpers/next";
import { form, makeCtx } from "@tests/helpers/fixtures";

const ctxMock = vi.hoisted(() => ({ access: vi.fn() }));
const sess = vi.hoisted(() => ({ audit: vi.fn() }));
vi.mock("@/lib/db", async () => (await import("@tests/helpers/db")).dbMock);
vi.mock("@/lib/ctx", () => ctxMock);
vi.mock("@/lib/session", () => sess);
vi.mock("next/cache", async () => (await import("@tests/helpers/next")).nextCacheMock);

import { markContacted } from "@/app/(app)/buyer/[id]/actions";

beforeEach(() => {
  routeDb([[/update buyer_conversations/, [{ conversation_id: "c-1" }]]]);
  ctxMock.access.mockResolvedValue(makeCtx("agent"));
  sess.audit.mockClear();
  nextCacheMock.revalidatePath.mockClear();
  query.mockClear();
});

describe("markContacted", () => {
  it("moves a buyer with an agent to done, scoped to the branch, and audits it", async () => {
    await markContacted(form({ id: "c-1" }));
    const [sql, params] = callsMatching(/update buyer_conversations/)[0];
    expect(String(sql)).toContain("handoff_status = 'done'");
    expect(String(sql)).toContain("ready_for_agent");
    expect(params).toEqual(["c-1", "pen"]);
    expect(sess.audit).toHaveBeenCalledWith(expect.any(String), "Buyer contacted", expect.stringContaining("c-1"), "prd", "pen");
    expect(nextCacheMock.revalidatePath).toHaveBeenCalledWith("/buyer");
  });

  it("does nothing without a session, without access, or for a viewer", async () => {
    for (const c of [null, "denied", makeCtx("viewer")]) {
      ctxMock.access.mockResolvedValue(c);
      await markContacted(form({ id: "c-1" }));
    }
    expect(callsMatching(/update buyer_conversations/)).toHaveLength(0);
    expect(sess.audit).not.toHaveBeenCalled();
  });

  it("ignores a missing or oversized id", async () => {
    await markContacted(form({}));
    await markContacted(form({ id: "x".repeat(300) }));
    expect(callsMatching(/update buyer_conversations/)).toHaveLength(0);
  });

  it("writes no audit row when nothing changed (not with an agent, already done, or another branch)", async () => {
    routeDb([[/update buyer_conversations/, []]]);
    await markContacted(form({ id: "c-9" }));
    expect(sess.audit).not.toHaveBeenCalled();
  });
});
