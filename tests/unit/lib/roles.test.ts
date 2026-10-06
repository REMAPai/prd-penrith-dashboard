import { describe, expect, it } from "vitest";
import { PAGES, ROLE_LABEL, STATUS_LABEL, canEditPipeline, canManageUsers, canRevealPii, canSee, pageByKey, type Role } from "@/lib/roles";
import { ROLES } from "@tests/helpers/fixtures";

// Written out by hand (not derived from the source) so a change to the access rules must be a deliberate edit here.
const EXPECTED: Record<string, Role[]> = {
  progress: ROLES,
  exec: ROLES,
  feedback: ROLES,
  buyer: ["platform_admin", "company_admin", "branch_admin", "marketing", "agent"],
  listings: ["platform_admin", "company_admin", "branch_admin", "marketing", "agent"],
  pipeline: ["platform_admin", "company_admin", "branch_admin", "marketing", "agent"],
  tasks: ["platform_admin", "company_admin", "branch_admin", "marketing", "agent"],
  map: ["platform_admin", "company_admin", "branch_admin", "marketing"],
  projects: ["platform_admin", "company_admin", "branch_admin", "marketing"],
  meta: ["platform_admin", "company_admin", "branch_admin", "marketing"],
  market: ["platform_admin", "company_admin", "branch_admin", "marketing"],
  pm: ["platform_admin", "company_admin", "branch_admin"],
  comm: ["platform_admin", "company_admin", "branch_admin"],
  finance: ["platform_admin", "company_admin", "branch_admin"],
  alerts: ["platform_admin", "company_admin", "branch_admin"],
  sources: ["platform_admin", "company_admin", "branch_admin"],
  users: ["platform_admin", "company_admin", "branch_admin"],
  audit: ["platform_admin", "company_admin", "branch_admin"],
  companies: ["platform_admin"],
};

describe("roles: page list", () => {
  it("has the expected pages, each with a unique key and an href matching the key", () => {
    expect(PAGES.map((p) => p.key).sort()).toEqual(Object.keys(EXPECTED).sort());
    expect(new Set(PAGES.map((p) => p.key)).size).toBe(PAGES.length);
    for (const p of PAGES) expect(p.href).toBe(`/${p.key}`);
  });

  it("only uses known statuses and groups", () => {
    for (const p of PAGES) expect(Object.keys(STATUS_LABEL)).toContain(p.status);
    expect([...new Set(PAGES.map((p) => p.group))]).toEqual(["Overview", "Departments", "Insights", "Operate", "Admin", "Platform"]);
  });

  it("finds a page by key", () => {
    expect(pageByKey("buyer").title).toBe("Buyer Sequencing");
    expect(pageByKey("nope")).toBeUndefined();
  });

  it("labels every role and status", () => {
    expect(Object.keys(ROLE_LABEL).sort()).toEqual([...ROLES].sort());
    expect(STATUS_LABEL.sample).toBe("Sample data");
  });
});

describe("roles: canSee for every role and page", () => {
  for (const page of PAGES) {
    for (const role of ROLES) {
      const want = EXPECTED[page.key].includes(role);
      it(`${role} ${want ? "can" : "cannot"} see ${page.key}`, () => {
        expect(canSee(role, page)).toBe(want);
      });
    }
  }

  it("platform pages are visible to platform admins only", () => {
    expect(PAGES.filter((p) => p.group === "Platform").every((p) => canSee("platform_admin", p) && !canSee("company_admin", p))).toBe(true);
  });
});

describe("roles: predicates", () => {
  it.each([
    ["platform_admin", true],
    ["company_admin", true],
    ["branch_admin", true],
    ["marketing", false],
    ["agent", false],
    ["viewer", false],
  ] as [Role, boolean][])("canManageUsers(%s) = %s", (r, v) => expect(canManageUsers(r)).toBe(v));

  it.each([
    ["platform_admin", true],
    ["company_admin", true],
    ["branch_admin", true],
    ["marketing", true],
    ["agent", false],
    ["viewer", false],
  ] as [Role, boolean][])("canEditPipeline(%s) = %s", (r, v) => expect(canEditPipeline(r)).toBe(v));

  it.each(ROLES.map((r) => [r, r !== "viewer"] as [Role, boolean]))("canRevealPii(%s) = %s", (r, v) => expect(canRevealPii(r)).toBe(v));
});
