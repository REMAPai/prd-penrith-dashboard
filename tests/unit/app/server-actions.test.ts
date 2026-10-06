import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { Ctx } from "@/lib/ctx";
import type { Role } from "@/lib/roles";
import { callsMatching, query, routeDb } from "@tests/helpers/db";
import { jar, nextCacheMock } from "@tests/helpers/next";
import { form, makeCtx } from "@tests/helpers/fixtures";
import { findActions, renderToHtml, resolveTree } from "@tests/helpers/render";

const ctxMock = vi.hoisted(() => ({ access: vi.fn(), getCtx: vi.fn() }));
const sess = vi.hoisted(() => ({ audit: vi.fn() }));
vi.mock("@/lib/db", async () => (await import("@tests/helpers/db")).dbMock);
vi.mock("@/lib/ctx", () => ctxMock);
vi.mock("@/lib/session", () => sess);
vi.mock("next/headers", async () => (await import("@tests/helpers/next")).nextHeadersMock);
vi.mock("next/cache", async () => (await import("@tests/helpers/next")).nextCacheMock);

import Users from "@/app/(app)/users/page";
import Pipeline from "@/app/(app)/pipeline/page";
import Tasks from "@/app/(app)/tasks/page";
import Feedback from "@/app/(app)/feedback/page";
import Progress from "@/app/(app)/progress/page";
import { setLiveOnly, setScope } from "@/app/(app)/actions";

type Action = (fd: FormData) => Promise<void>;
type Page = (props: never) => Promise<ReactNode>;

const allow = (c: Ctx | "denied" | null) => {
  ctxMock.access.mockResolvedValue(c);
  ctxMock.getCtx.mockResolvedValue(c === "denied" ? null : c);
};

/** Renders a page as an editor so its forms exist, returns their server actions, then switches to the real actor. */
async function actions(page: Page, props: unknown, render: Ctx) {
  allow(render);
  const out = findActions(await resolveTree(await (page as unknown as (p: unknown) => Promise<ReactNode>)(props)));
  query.mockClear();
  sess.audit.mockClear();
  nextCacheMock.revalidatePath.mockClear();
  return out;
}
const writes = () => query.mock.calls.filter((c) => /^\s*(insert|update|delete)/i.test(String(c[0])));

beforeEach(() => {
  routeDb([]);
});

describe("users: addUser", () => {
  let addUser: Action;
  beforeEach(async () => {
    ({ addUser } = await actions(Users as Page, {}, makeCtx("platform_admin")));
  });
  const fd = (o: Record<string, string> = {}) => form({ email: "New.Person@prd.test", name: "New Person", role: "viewer", branch: "pen", ...o });

  it("does nothing without a session or without access to the page", async () => {
    allow(null);
    await addUser(fd());
    allow("denied");
    await addUser(fd());
    expect(writes()).toHaveLength(0);
  });

  it("a branch admin can add marketing, agent and viewer to their own branch", async () => {
    for (const role of ["marketing", "agent", "viewer"]) {
      allow(makeCtx("branch_admin"));
      query.mockClear();
      await addUser(fd({ role }));
      const [sql, params] = callsMatching(/insert into users/)[0];
      expect(sql).toContain("on conflict (email) do nothing");
      expect(params).toEqual(["New.Person@prd.test", "New Person", role, "prd", "pen"]);
    }
  });

  it.each(["platform_admin", "company_admin", "branch_admin"])("a branch admin cannot grant %s", async (role) => {
    allow(makeCtx("branch_admin"));
    await addUser(fd({ role }));
    expect(writes()).toHaveLength(0);
    expect(sess.audit).not.toHaveBeenCalled();
  });

  it.each(["platform_admin", "company_admin"])("a company admin cannot grant %s", async (role) => {
    allow(makeCtx("company_admin"));
    await addUser(fd({ role }));
    expect(writes()).toHaveLength(0);
  });

  it("a company admin can add a branch admin to another branch of their company but not to another company's branch", async () => {
    allow(makeCtx("company_admin"));
    await addUser(fd({ role: "branch_admin", branch: "gp" }));
    expect(callsMatching(/insert into users/)[0][1]).toEqual(["New.Person@prd.test", "New Person", "branch_admin", "prd", "gp"]);
    query.mockClear();
    await addUser(fd({ role: "branch_admin", branch: "oth" }));
    expect(writes()).toHaveLength(0);
  });

  it("a branch admin cannot add to a branch other than their own", async () => {
    allow(makeCtx("branch_admin"));
    await addUser(fd({ branch: "bm" }));
    expect(writes()).toHaveLength(0);
  });

  it("a platform admin can add another platform admin with no company or branch", async () => {
    allow(makeCtx("platform_admin"));
    await addUser(fd({ role: "platform_admin", branch: "does-not-matter" }));
    expect(callsMatching(/insert into users/)[0][1]).toEqual(["New.Person@prd.test", "New Person", "platform_admin", null, null]);
  });

  it("company admins are not tied to a branch", async () => {
    allow(makeCtx("platform_admin"));
    await addUser(fd({ role: "company_admin", branch: "pen" }));
    expect(callsMatching(/insert into users/)[0][1]).toEqual(["New.Person@prd.test", "New Person", "company_admin", "prd", null]);
  });

  it("rejects bad input", async () => {
    allow(makeCtx("platform_admin"));
    const bads: Record<string, string>[] = [{ email: "nope" }, { name: "x" }, { email: "a".repeat(201) + "@x.test" }, { role: "god" }, { branch: "zzz", role: "viewer" }];
    for (const bad of bads) {
      await addUser(fd(bad));
    }
    expect(writes()).toHaveLength(0);
  });

  it("audits the grant and refreshes the page", async () => {
    allow(makeCtx("branch_admin"));
    await addUser(fd());
    expect(sess.audit).toHaveBeenCalledWith("branch_admin@test.example", "User added", "New.Person@prd.test as Viewer", "prd", "pen");
    expect(nextCacheMock.revalidatePath).toHaveBeenCalledWith("/users");
  });
});

describe("users: toggleUser", () => {
  let toggleUser: Action;
  const target = (o: Record<string, unknown> = {}) => routeDb([[/from users where lower\(email\)/, [{ role: "viewer", company_id: "prd", branch_id: "pen", status: "active", ...o }]]]);
  beforeEach(async () => {
    routeDb([[/from users order by/, [{ email: "v@x.test", name: "V", role: "viewer", company_id: "prd", branch_id: "pen", status: "active", last_login: null }]]]);
    ({ toggleUser } = await actions(Users as Page, {}, makeCtx("platform_admin")));
  });
  const t = (email = "viewer@prd.test") => form({ email });

  it("cannot deactivate yourself (case-insensitive)", async () => {
    allow(makeCtx("platform_admin"));
    target();
    await toggleUser(t("PLATFORM_ADMIN@test.example"));
    expect(writes()).toHaveLength(0);
  });

  it("does nothing for an unknown user or without access", async () => {
    allow(makeCtx("platform_admin"));
    routeDb([]);
    await toggleUser(t());
    allow("denied");
    target();
    await toggleUser(t());
    allow(null);
    await toggleUser(t());
    expect(writes()).toHaveLength(0);
  });

  it("a branch admin can deactivate then reactivate a viewer in their own branch", async () => {
    allow(makeCtx("branch_admin"));
    target();
    await toggleUser(t());
    expect(callsMatching(/update users set status/)[0][1]).toEqual(["deactivated", "viewer@prd.test"]);
    expect(sess.audit).toHaveBeenCalledWith("branch_admin@test.example", "User status", "viewer@prd.test set to deactivated", "prd", "pen");
    query.mockClear();
    target({ status: "deactivated" });
    await toggleUser(t());
    expect(callsMatching(/update users set status/)[0][1]).toEqual(["active", "viewer@prd.test"]);
  });

  it("a branch admin cannot touch users in another branch, peers, or higher roles", async () => {
    allow(makeCtx("branch_admin"));
    for (const t2 of [{ branch_id: "bm" }, { role: "branch_admin" }, { role: "company_admin", branch_id: null }, { role: "platform_admin", company_id: null, branch_id: null }]) {
      target(t2);
      await toggleUser(t());
    }
    expect(writes()).toHaveLength(0);
  });

  it("a company admin is limited to their own company and to roles below company admin", async () => {
    allow(makeCtx("company_admin"));
    for (const t2 of [{ company_id: "other" }, { role: "company_admin", branch_id: null }, { role: "platform_admin", company_id: null }]) {
      target(t2);
      await toggleUser(t());
    }
    expect(writes()).toHaveLength(0);
    target({ role: "branch_admin", branch_id: "bm" });
    await toggleUser(t());
    expect(callsMatching(/update users set status/)).toHaveLength(1);
  });

  it("a platform admin can toggle anyone else, including another platform admin", async () => {
    allow(makeCtx("platform_admin"));
    target({ role: "platform_admin", company_id: null, branch_id: null });
    await toggleUser(t("other.admin@remap.ai"));
    expect(callsMatching(/update users set status/)).toHaveLength(1);
  });
});

describe("users page: data scoping and form options", () => {
  const listQuery = () => callsMatching(/from users/).map((c) => [String(c[0]), c[1]] as const)[0];

  it("platform admins list everyone; company admins their company; others their branch", async () => {
    allow(makeCtx("platform_admin"));
    await Users();
    expect(listQuery()[1]).toBeUndefined();
    query.mockClear();
    allow(makeCtx("company_admin"));
    await Users();
    expect(listQuery()[0]).toContain("where company_id = $1");
    expect(listQuery()[1]).toEqual(["prd"]);
    query.mockClear();
    allow(makeCtx("branch_admin"));
    await Users();
    expect(listQuery()[0]).toContain("where branch_id = $1");
    expect(listQuery()[1]).toEqual(["pen"]);
  });

  it("renders Denied for a viewer and nothing when signed out", async () => {
    allow("denied");
    expect(await renderToHtml(await Users())).toContain("No access");
    allow(null);
    expect(await Users()).toBeNull();
  });
});

describe("pipeline actions", () => {
  let moveStage: Action;
  let confirmZoning: Action;
  const site = { id: 1, address: "84 Cox Avenue", suburb: "Penrith", zoning: "TBC", zoning_confirmed: false, lot_size: null, stage: 0, priority: "M", is_sample: false, identified_on: "2026-06-26", stage_changed_at: "2026-06-26T00:00:00Z", da_type: "DA", da_status: "Lodged" };
  const own = () => routeDb([[/select address, stage from pipeline_sites/, [{ address: "84 Cox Avenue", stage: 0 }]]]);

  beforeEach(async () => {
    routeDb([[/from pipeline_sites where branch_id/, [site]]]);
    ({ moveStage, confirmZoning } = await actions(Pipeline as Page, { searchParams: Promise.resolve({ site: "1" }) }, makeCtx("branch_admin")));
  });

  it.each(["platform_admin", "company_admin", "branch_admin", "marketing"] as Role[])("%s can move a stage, writing the event and an audit row", async (role) => {
    allow(makeCtx(role));
    own();
    await moveStage(form({ id: 1, stage: 3 }));
    expect(callsMatching(/update pipeline_sites set stage/)[0][1]).toEqual([3, 1]);
    expect(callsMatching(/insert into pipeline_events/)[0][1]).toEqual([1, `${role}@test.example`, "Detected to Approached"]);
    expect(sess.audit).toHaveBeenCalledWith(`${role}@test.example`, "Stage move", "84 Cox Avenue: Detected to Approached", "prd", "pen");
    expect(nextCacheMock.revalidatePath).toHaveBeenCalledWith("/pipeline");
  });

  it("an agent (read only) and a viewer (no access) cannot move a stage", async () => {
    own();
    allow(makeCtx("agent"));
    await moveStage(form({ id: 1, stage: 3 }));
    allow("denied");
    await moveStage(form({ id: 1, stage: 3 }));
    allow(null);
    await moveStage(form({ id: 1, stage: 3 }));
    expect(writes()).toHaveLength(0);
  });

  it("only looks up sites in the actor's branch", async () => {
    allow(makeCtx("branch_admin", { branch: { id: "bm", company_id: "prd", name: "Blue Mountains", suburbs: [] } }));
    routeDb([]);
    await moveStage(form({ id: 1, stage: 3 }));
    expect(callsMatching(/select address, stage/)[0][1]).toEqual([1, "bm"]);
    expect(writes()).toHaveLength(0);
  });

  it.each([-1, 10, 2.5, "x", ""])("rejects stage %j", async (stage) => {
    allow(makeCtx("branch_admin"));
    own();
    await moveStage(form({ id: 1, stage }));
    expect(writes()).toHaveLength(0);
  });

  it("ignores a move to the stage the site is already in", async () => {
    allow(makeCtx("branch_admin"));
    own();
    await moveStage(form({ id: 1, stage: 0 }));
    expect(writes()).toHaveLength(0);
  });

  it("confirms zoning (trimmed, max 80 characters), scoped to the branch, with history and audit", async () => {
    allow(makeCtx("branch_admin"));
    await confirmZoning(form({ id: 1, zoning: `  R3 Medium Density ${"x".repeat(100)}` }));
    const [, params] = callsMatching(/update pipeline_sites set zoning/)[0];
    expect(params![0]).toHaveLength(80);
    expect(String(params![0]).startsWith("R3 Medium Density")).toBe(true);
    expect(params!.slice(1)).toEqual([1, "pen"]);
    expect(callsMatching(/insert into pipeline_events/)[0][1]![2]).toContain("Zoning confirmed as R3");
    expect(sess.audit).toHaveBeenCalledWith("branch_admin@test.example", "Zoning confirmed", expect.stringContaining("Site 1: R3"), "prd", "pen");
  });

  it("refuses an empty zoning and refuses non-editors", async () => {
    allow(makeCtx("branch_admin"));
    await confirmZoning(form({ id: 1, zoning: "   " }));
    allow(makeCtx("agent"));
    await confirmZoning(form({ id: 1, zoning: "R3" }));
    allow("denied");
    await confirmZoning(form({ id: 1, zoning: "R3" }));
    expect(writes()).toHaveLength(0);
  });
});

describe("tasks actions", () => {
  let addTask: Action;
  let toggleTask: Action;
  beforeEach(async () => {
    routeDb([[/from tasks where branch_id/, [{ id: 7, text: "Do it", assignee: null, due: null, done: false }]]]);
    ({ addTask, toggleTask } = await actions(Tasks as Page, {}, makeCtx("branch_admin")));
  });

  it("adds a task to the actor's branch, storing blanks as null", async () => {
    allow(makeCtx("agent"));
    await addTask(form({ text: "Confirm zoning: 18 Sydney St", assignee: "", due: "" }));
    expect(callsMatching(/insert into tasks/)[0][1]).toEqual(["pen", "Confirm zoning: 18 Sydney St", null, null]);
    await addTask(form({ text: "Another", assignee: "Thomas", due: "Friday" }));
    expect(callsMatching(/insert into tasks/)[1][1]).toEqual(["pen", "Another", "Thomas", "Friday"]);
    expect(nextCacheMock.revalidatePath).toHaveBeenCalledWith("/tasks");
  });

  it("rejects too-short and too-long input and unauthorised callers", async () => {
    allow(makeCtx("agent"));
    await addTask(form({ text: "x" }));
    await addTask(form({ text: "y".repeat(201) }));
    await addTask(form({ text: "ok task", assignee: "z".repeat(81) }));
    allow("denied");
    await addTask(form({ text: "valid text" }));
    allow(null);
    await addTask(form({ text: "valid text" }));
    expect(writes()).toHaveLength(0);
  });

  it("toggles only a task in the actor's branch", async () => {
    allow(makeCtx("agent"));
    await toggleTask(form({ id: 7 }));
    const [sql, params] = callsMatching(/update tasks set done/)[0];
    expect(sql).toContain("not done");
    expect(params).toEqual([7, "pen"]);
    allow("denied");
    query.mockClear();
    await toggleTask(form({ id: 7 }));
    expect(writes()).toHaveLength(0);
  });
});

describe("feedback actions", () => {
  let submit: Action;
  let vote: Action;
  let setStatus: Action;
  beforeEach(async () => {
    routeDb([[/from feedback/, [{ id: 3, page: "General", rating: "useful", body: "hi", status: "New", votes: 0, author_email: "a@b.test", created_at: "2026-10-01T00:00:00Z" }]]]);
    ({ submit, vote, setStatus } = await actions(Feedback as Page, {}, makeCtx("platform_admin")));
  });

  it("any signed-in role (even a viewer) can submit feedback, recorded against the author and branch", async () => {
    allow(makeCtx("viewer"));
    await submit(form({ body: "The map is slow", page: "Map", rating: "confusing" }));
    expect(callsMatching(/insert into feedback/)[0][1]).toEqual(["pen", "Map", "confusing", "The map is slow", "viewer@test.example"]);
  });

  it("validates the rating, body and page", async () => {
    allow(makeCtx("viewer"));
    await submit(form({ body: "ok body", page: "Map", rating: "love" }));
    await submit(form({ body: "no", page: "Map", rating: "useful" }));
    await submit(form({ body: "x".repeat(1001), page: "Map", rating: "useful" }));
    await submit(form({ body: "ok body", page: "p".repeat(61), rating: "useful" }));
    allow(null);
    await submit(form({ body: "ok body", page: "Map", rating: "useful" }));
    expect(writes()).toHaveLength(0);
  });

  it("votes with an increment", async () => {
    allow(makeCtx("viewer"));
    await vote(form({ id: 3 }));
    const [sql, params] = callsMatching(/update feedback set votes/)[0];
    expect(sql).toContain("votes + 1");
    expect(params).toEqual([3]);
    allow(null);
    query.mockClear();
    await vote(form({ id: 3 }));
    expect(writes()).toHaveLength(0);
  });

  it("only platform admins triage, with a known status, and the change is audited", async () => {
    allow(makeCtx("platform_admin"));
    await setStatus(form({ id: 3, status: "Done" }));
    expect(callsMatching(/update feedback set status/)[0][1]).toEqual(["Done", 3]);
    expect(sess.audit).toHaveBeenCalledWith("platform_admin@test.example", "Feedback status", "Feedback 3 set to Done", "prd", "pen");
    query.mockClear();
    await setStatus(form({ id: 3, status: "Invented" }));
    for (const role of ["company_admin", "branch_admin", "marketing", "agent", "viewer"] as Role[]) {
      allow(makeCtx(role));
      await setStatus(form({ id: 3, status: "Done" }));
    }
    expect(writes()).toHaveLength(0);
  });
});

describe("progress: toggleAsk", () => {
  let toggleAsk: Action;
  beforeEach(async () => {
    routeDb([[/from progress_items order by id/, [{ id: 5, project: "Buyer Sequencing", kind: "ask", text: "Confirm rule", owner: "Thomas", due: "This week", status: "open" }]]]);
    ({ toggleAsk } = await actions(Progress as Page, {}, makeCtx("branch_admin")));
  });

  it("viewers cannot tick items off", async () => {
    allow(makeCtx("viewer"));
    await toggleAsk(form({ id: 5 }));
    allow(null);
    await toggleAsk(form({ id: 5 }));
    expect(writes()).toHaveLength(0);
  });

  it("only touches ask items and audits Done / Reopened from the returned status", async () => {
    allow(makeCtx("agent"));
    routeDb([[/update progress_items/, [{ status: "done", text: "Confirm rule" }]]]);
    await toggleAsk(form({ id: 5 }));
    expect(String(query.mock.calls[0][0])).toContain("kind = 'ask'");
    expect(sess.audit).toHaveBeenCalledWith("agent@test.example", "Progress item", "Done: Confirm rule", "prd", "pen");
    routeDb([[/update progress_items/, [{ status: "open", text: "Confirm rule" }]]]);
    await toggleAsk(form({ id: 5 }));
    expect(sess.audit).toHaveBeenLastCalledWith("agent@test.example", "Progress item", "Reopened: Confirm rule", "prd", "pen");
  });

  it("does not audit when no row matched", async () => {
    allow(makeCtx("agent"));
    routeDb([]);
    sess.audit.mockClear();
    await toggleAsk(form({ id: 999 }));
    expect(sess.audit).not.toHaveBeenCalled();
  });
});

describe("shared top-bar actions", () => {
  it("setLiveOnly stores 1 or 0 for 30 days and refreshes the layout", async () => {
    await setLiveOnly(true);
    expect(jar.get("liveOnly")?.value).toBe("1");
    expect(jar.options("liveOnly")).toMatchObject({ path: "/", maxAge: 2592000, sameSite: "lax" });
    await setLiveOnly(false);
    expect(jar.get("liveOnly")?.value).toBe("0");
    expect(nextCacheMock.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("setScope stores only a branch the user may see", async () => {
    allow(makeCtx("branch_admin"));
    await setScope("bm");
    expect(jar.has("scope")).toBe(false);
    await setScope("pen");
    expect(jar.get("scope")?.value).toBe("pen");
  });

  it("setScope lets a platform admin pick any branch and ignores signed-out callers", async () => {
    allow(makeCtx("platform_admin"));
    await setScope("oth");
    expect(jar.get("scope")?.value).toBe("oth");
    jar.clear();
    allow(null);
    await setScope("pen");
    expect(jar.has("scope")).toBe(false);
  });
});
