import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { Ctx } from "@/lib/ctx";
import { callsMatching, query, routeDb } from "@tests/helpers/db";
import { form, makeCtx } from "@tests/helpers/fixtures";
import { findActions, renderToHtml, resolveTree } from "@tests/helpers/render";

const ctxMock = vi.hoisted(() => ({ access: vi.fn(), getCtx: vi.fn() }));
vi.mock("@/lib/db", async () => (await import("@tests/helpers/db")).dbMock);
vi.mock("@/lib/ctx", () => ctxMock);
vi.mock("@/lib/session", () => ({ audit: vi.fn() }));
vi.mock("next/cache", async () => (await import("@tests/helpers/next")).nextCacheMock);

import Feedback from "@/app/(app)/feedback/page";
import Progress from "@/app/(app)/progress/page";

type Page = (props: never) => Promise<ReactNode>;
const render = async (page: Page, ctx: Ctx) => {
  ctxMock.access.mockResolvedValue(ctx);
  return resolveTree(await (page as unknown as () => Promise<ReactNode>)());
};
const fb = (voted: boolean) => ({ id: 3, page: "General", rating: "useful", body: "hi", status: "New", votes: 1, voted, author_email: "a@b.test", created_at: "2026-10-01T00:00:00Z" });

beforeEach(() => routeDb([]));

describe("feedback vote button", () => {
  it("shows a disabled Voted button when the current user already voted, +1 otherwise", async () => {
    routeDb([[/from feedback/, [fb(true)]]]);
    const voted = await renderToHtml(await render(Feedback as Page, makeCtx("viewer")));
    expect(voted).toMatch(/<button[^>]*disabled[^>]*>Voted/);
    routeDb([[/from feedback/, [fb(false)]]]);
    const open = await renderToHtml(await render(Feedback as Page, makeCtx("viewer")));
    expect(open).toContain("+1");
    expect(open).not.toContain("Voted");
  });

  it("asks the database whether this user voted", async () => {
    routeDb([[/from feedback/, [fb(false)]]]);
    await render(Feedback as Page, makeCtx("viewer"));
    const [sql, params] = callsMatching(/from feedback/)[0];
    expect(sql).toContain("feedback_votes");
    expect(params).toEqual(["viewer@test.example"]);
  });

  it("ignores a non-numeric id", async () => {
    routeDb([[/from feedback/, [fb(false)]]]);
    const { vote } = findActions(await render(Feedback as Page, makeCtx("viewer")));
    query.mockClear();
    await vote(form({ id: "abc" }));
    expect(query).not.toHaveBeenCalled();
  });
});

describe("progress page scoping", () => {
  it("selects only the signed-in company's items", async () => {
    await render(Progress as Page, makeCtx("agent"));
    const [sql, params] = callsMatching(/from progress_items/)[0];
    expect(sql).toContain("where company_id = $1");
    expect(params).toEqual(["prd"]);
  });
});

describe("migration 004", () => {
  const sql = readFileSync(join(process.cwd(), "db", "migrations", "004_hardening.sql"), "utf8");
  it("defines votes, login attempts and the audit trigger idempotently", () => {
    expect(sql).toMatch(/create table if not exists feedback_votes[\s\S]*primary key \(feedback_id, voter_email\)/);
    expect(sql).toMatch(/references feedback\(id\) on delete cascade/);
    expect(sql).toMatch(/create table if not exists login_attempts/);
    expect(sql).toMatch(/create index if not exists \w+ on login_attempts \(email, at\)/);
    expect(sql).toMatch(/add column if not exists company_id text references companies\(id\)/);
    expect(sql).toMatch(/update progress_items set company_id = 'prd' where company_id is null/);
    expect(sql).toMatch(/create or replace function audit_log_block_mutation/);
    expect(sql).toMatch(/raise exception/);
    expect(sql).toMatch(/drop trigger if exists audit_log_append_only on audit_log/);
    expect(sql).toMatch(/create trigger audit_log_append_only before update or delete on audit_log/);
    expect(sql).toMatch(/TRUNCATE/);
  });
});
