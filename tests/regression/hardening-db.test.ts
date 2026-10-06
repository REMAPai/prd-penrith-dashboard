import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import bcrypt from "bcryptjs";
import { callsMatching, query, routeDb } from "@tests/helpers/db";
import { form, makeCtx, makeSession } from "@tests/helpers/fixtures";
import { findActions, resolveTree } from "@tests/helpers/render";

const ctxMock = vi.hoisted(() => ({ access: vi.fn(), getCtx: vi.fn() }));
const sess = vi.hoisted(() => ({ audit: vi.fn(), destroySession: vi.fn(), signInUser: vi.fn(), getSession: vi.fn() }));
vi.mock("@/lib/db", async () => (await import("@tests/helpers/db")).dbMock);
vi.mock("@/lib/ctx", () => ctxMock);
vi.mock("@/lib/session", () => sess);
vi.mock("next/cache", async () => (await import("@tests/helpers/next")).nextCacheMock);
vi.mock("next/navigation", async () => (await import("@tests/helpers/next")).nextNavigationMock);

import Feedback from "@/app/(app)/feedback/page";
import Progress from "@/app/(app)/progress/page";
import { passwordLogin } from "@/app/login/actions";

const actionsOf = async (page: unknown) => {
  routeDb([
    [/from feedback/, [{ id: 3, page: "General", rating: "useful", body: "hi", status: "New", votes: 0, voted: false, author_email: "a@b.test", created_at: "2026-10-01T00:00:00Z" }]],
    [/from progress_items/, [{ id: 5, project: "Buyer Sequencing", kind: "ask", text: "Confirm rule", owner: "Thomas", due: "This week", status: "open" }]],
  ]);
  ctxMock.access.mockResolvedValue(makeCtx("agent"));
  return findActions(await resolveTree(await (page as () => Promise<ReactNode>)()));
};

beforeEach(() => {
  query.mockReset();
  query.mockImplementation(async () => []);
});

describe("regression: database hardening", () => {
  it("Bug: one user could +1 a feedback item many times (votes were not de-duplicated)", async () => {
    const { vote } = await actionsOf(Feedback);
    query.mockClear();
    await vote(form({ id: 3 }));
    await vote(form({ id: 3 }));
    const calls = callsMatching(/feedback_votes/);
    expect(calls).toHaveLength(2);
    for (const [sql] of calls) {
      expect(sql).toMatch(/insert into feedback_votes[\s\S]*on conflict do nothing[\s\S]*update feedback set votes = votes \+ 1 where id = \$1 and exists \(select 1 from ins\)/);
    }
    expect(callsMatching(/^update feedback set votes = votes \+ 1/)).toHaveLength(0);
  });

  it("Bug: toggleAsk updated any progress item regardless of company", async () => {
    const { toggleAsk } = await actionsOf(Progress);
    query.mockClear();
    await toggleAsk(form({ id: 5 }));
    const [sql, params] = callsMatching(/update progress_items/)[0];
    expect(sql).toMatch(/where id = \$1 and kind = 'ask' and company_id = \$2/);
    expect(params).toEqual([5, "prd"]);
  });

  it("Bug: the login rate limit lived in process memory (reset on deploy, per instance); the sixth attempt must be blocked from the database", async () => {
    const hash = await bcrypt.hash("right", 4);
    let n = 0;
    query.mockImplementation(async (sql: string) => {
      if (/count\(\*\)::int as n from login_attempts/.test(sql)) return [{ n }];
      if (/insert into login_attempts/.test(sql)) n++;
      if (/from users/.test(sql)) return [{ password_hash: hash, status: "active" }];
      return [];
    });
    for (let i = 0; i < 5; i++) expect(await passwordLogin(undefined, form({ email: "a@b.test", password: "bad" }))).toEqual({ error: "Wrong email or password." });
    sess.signInUser.mockResolvedValue(makeSession("viewer"));
    expect(await passwordLogin(undefined, form({ email: "a@b.test", password: "right" }))).toEqual({ error: "Too many attempts. Try again in a few minutes." });
    expect(sess.signInUser).not.toHaveBeenCalled();
    query.mockImplementation(async () => {
      throw new Error("db down");
    });
    expect((await passwordLogin(undefined, form({ email: "a@b.test", password: "right" }))).error).toMatch(/unavailable/);
  });

  it("Bug: audit_log was append-only by convention only; the migration must block UPDATE and DELETE with a trigger", () => {
    const sql = readFileSync(join(process.cwd(), "db", "migrations", "004_hardening.sql"), "utf8");
    expect(sql).toMatch(/create trigger audit_log_append_only before update or delete on audit_log/);
    expect(sql).toMatch(/raise exception 'audit_log is append-only/);
  });
});
