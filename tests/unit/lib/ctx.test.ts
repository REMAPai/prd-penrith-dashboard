import { describe, expect, it, vi } from "vitest";
import { BRANCHES, ROLES, makeSession } from "@tests/helpers/fixtures";
import { routeDb, query } from "@tests/helpers/db";
import { jar } from "@tests/helpers/next";
import type { Session } from "@/lib/session";

vi.mock("@/lib/db", async () => (await import("@tests/helpers/db")).dbMock);
vi.mock("next/headers", async () => (await import("@tests/helpers/next")).nextHeadersMock);
const getSession = vi.hoisted(() => vi.fn<() => Promise<Session | null>>());
vi.mock("@/lib/session", () => ({ getSession }));

import { access, getCtx } from "@/lib/ctx";

const setup = (s: Session | null) => {
  getSession.mockResolvedValue(s);
  routeDb([
    [/from branches/, BRANCHES],
    [/from companies/, (p) => (p[0] === "other" ? [{ name: "Other Co" }] : [{ name: "PRD Group" }])],
  ]);
};

describe("getCtx", () => {
  it("is null without a session and does not touch the database", async () => {
    setup(null);
    expect(await getCtx()).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it("platform admins see every branch and default to Penrith", async () => {
    setup(makeSession("platform_admin"));
    const c = (await getCtx())!;
    expect(c.branches.map((b) => b.id)).toEqual(["pen", "bm", "gp", "oth"]);
    expect(c.branch.id).toBe("pen");
    expect(c.companyName).toBe("PRD Group");
  });

  it("company admins see only their company's branches", async () => {
    setup(makeSession("company_admin"));
    expect((await getCtx())!.branches.map((b) => b.id)).toEqual(["pen", "bm", "gp"]);
  });

  it.each(ROLES.filter((r) => !["platform_admin", "company_admin"].includes(r)))("%s sees only their own branch", async (role) => {
    setup(makeSession(role, { branchId: "bm" }));
    const c = (await getCtx())!;
    expect(c.branches.map((b) => b.id)).toEqual(["bm"]);
    expect(c.branch.id).toBe("bm");
  });

  it("honours the scope cookie only for an allowed branch", async () => {
    setup(makeSession("company_admin"));
    jar.set("scope", "gp");
    expect((await getCtx())!.branch.id).toBe("gp");
    jar.set("scope", "oth");
    expect((await getCtx())!.branch.id).toBe("pen");
  });

  it("falls back to the first allowed branch when Penrith is not allowed", async () => {
    setup(makeSession("branch_admin", { branchId: "gp" }));
    jar.set("scope", "pen");
    expect((await getCtx())!.branch.id).toBe("gp");
  });

  it("reads the liveOnly cookie", async () => {
    setup(makeSession("platform_admin"));
    expect((await getCtx())!.liveOnly).toBe(false);
    jar.set("liveOnly", "1");
    expect((await getCtx())!.liveOnly).toBe(true);
    jar.set("liveOnly", "0");
    expect((await getCtx())!.liveOnly).toBe(false);
  });

  it("uses the selected branch's company name, defaulting to PRD Group", async () => {
    setup(makeSession("platform_admin"));
    jar.set("scope", "oth");
    expect((await getCtx())!.companyName).toBe("Other Co");
    routeDb([[/from branches/, BRANCHES], [/from companies/, []]]);
    expect((await getCtx())!.companyName).toBe("PRD Group");
  });
});

describe("access", () => {
  it("returns null with no session", async () => {
    setup(null);
    expect(await access("buyer")).toBeNull();
  });

  it("returns the context when the role may see the page", async () => {
    setup(makeSession("agent"));
    const r = await access("buyer");
    expect(r).not.toBe("denied");
    expect(r).not.toBeNull();
  });

  it("returns 'denied' when the role may not see the page", async () => {
    setup(makeSession("viewer"));
    expect(await access("buyer")).toBe("denied");
    setup(makeSession("branch_admin"));
    expect(await access("companies")).toBe("denied");
  });
});
