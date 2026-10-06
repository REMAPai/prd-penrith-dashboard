import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { PAGES, ROLE_LABEL, canSee, type Role } from "@/lib/roles";
import type { Session } from "@/lib/session";
import { BRANCHES, ROLES, makeSession } from "@tests/helpers/fixtures";
import { callsMatching, query, routeDb } from "@tests/helpers/db";
import { jar } from "@tests/helpers/next";
import { renderPage } from "@tests/helpers/render";

const sess = vi.hoisted(() => ({ getSession: vi.fn<() => Promise<Session | null>>(), audit: vi.fn() }));
vi.mock("@/lib/db", async () => (await import("@tests/helpers/db")).dbMock);
vi.mock("@/lib/session", () => sess);
vi.mock("next/headers", async () => (await import("@tests/helpers/next")).nextHeadersMock);
vi.mock("next/cache", async () => (await import("@tests/helpers/next")).nextCacheMock);
vi.mock("next/navigation", async () => (await import("@tests/helpers/next")).nextNavigationMock);
vi.mock("@/components/MapLoader", () => ({ default: (props: object) => createElement("pre", { id: "map-props" }, JSON.stringify(props)) }));

import Progress from "@/app/(app)/progress/page";
import Exec from "@/app/(app)/exec/page";
import Buyer from "@/app/(app)/buyer/page";
import Listings from "@/app/(app)/listings/page";
import Pipeline from "@/app/(app)/pipeline/page";
import MapPage from "@/app/(app)/map/page";
import Projects from "@/app/(app)/projects/page";
import Meta from "@/app/(app)/meta/page";
import PM from "@/app/(app)/pm/page";
import Commercial from "@/app/(app)/comm/page";
import Market from "@/app/(app)/market/page";
import Finance from "@/app/(app)/finance/page";
import Tasks from "@/app/(app)/tasks/page";
import Alerts from "@/app/(app)/alerts/page";
import Feedback from "@/app/(app)/feedback/page";
import Sources from "@/app/(app)/sources/page";
import Users from "@/app/(app)/users/page";
import AuditPage from "@/app/(app)/audit/page";
import Companies from "@/app/(app)/companies/page";

type Page = (props: never) => Promise<ReactNode>;
const PAGE_FNS: Record<string, Page> = {
  progress: Progress, exec: Exec, buyer: Buyer, listings: Listings, pipeline: Pipeline, map: MapPage, projects: Projects, meta: Meta, pm: PM, comm: Commercial,
  market: Market, finance: Finance, tasks: Tasks, alerts: Alerts, feedback: Feedback, sources: Sources, users: Users, audit: AuditPage, companies: Companies,
} as unknown as Record<string, Page>;

const sites = [
  { id: 1, branch_id: "pen", address: "84 Cox Avenue", suburb: "Penrith", zoning: "TBC", zoning_confirmed: false, lot_size: null, stage: 0, priority: "M", signal: "DA lodged", da_number: null, da_type: "DA", da_status: "Lodged", source: "PlanningAlerts", assignee: null, next_step: "Confirm zoning", notes: null, is_sample: false, identified_on: "2026-06-26", stage_changed_at: "2026-06-26T00:00:00Z", lat: -33.75, lng: 150.69 },
  { id: 2, branch_id: "pen", address: "9 Sample Street", suburb: "St Marys", zoning: "R3", zoning_confirmed: true, lot_size: "600 m2", stage: 4, priority: "H", signal: "Sample", da_number: "SAMPLE/1", da_type: null, da_status: null, source: "Sample", assignee: "Sample Agent", next_step: null, notes: null, is_sample: true, identified_on: "2026-09-01", stage_changed_at: "2026-09-02T00:00:00Z", lat: -33.76, lng: 150.77 },
];
const userRows = [{ email: "v@prd.test", name: "Vee", role: "viewer", company_id: "prd", branch_id: "pen", status: "active", last_login: null }];

const seedDb = () =>
  routeDb([
    [/join companies c/, [{ company: "PRD Group", entra: true, branch: "Penrith", suburbs: ["Penrith"], users: "3" }]],
    [/from tenants t/, [{ tid: "7b712bf0-a681-4071-adb1-fd3b7cdd4238", name: "REMAP.ai", kind: "platform", domains: ["remap.ai"], users: "1" }]],
    [/select id, company_id, name, suburbs from branches/, BRANCHES],
    [/select name from companies/, [{ name: "PRD Group" }]],
    [/from pipeline_sites/, sites],
    [/from users/, userRows],
    [/from tasks/, [{ id: 1, text: "A task", assignee: "Bob", due: "Fri", done: false }]],
    [/from audit_log/, [{ at: "2026-10-01T00:00:00Z", actor_email: "a@b.test", action: "Sign-in", detail: "x" }]],
    [/from feedback/, [{ id: 1, page: "Map", rating: "useful", body: "Nice", status: "Done", votes: 2, author_email: "a@b.test", created_at: "2026-10-01T00:00:00Z" }]],
    [/from progress_items/, [{ id: 1, project: "Buyer Sequencing", kind: "ask", text: "Do a thing", owner: "Thomas", due: "This week", status: "open" }, { id: 2, project: "Platform", kind: "milestone", text: "Milestone", owner: null, due: "done", status: "open" }]],
  ]);

const as = (role: Role | null, over: Partial<Session> = {}) => {
  sess.getSession.mockResolvedValue(role ? makeSession(role, over) : null);
  seedDb();
};
const sp = (o: Record<string, string> = {}) => ({ searchParams: Promise.resolve(o) });
const title = (key: string) => PAGES.find((p) => p.key === key)!.title;

describe("every page x every role", () => {
  for (const page of PAGES) {
    describe(page.key, () => {
      it("returns nothing when signed out", async () => {
        as(null);
        expect(await PAGE_FNS[page.key](sp() as never)).toBeNull();
      });

      for (const role of ROLES) {
        const allowed = canSee(role, page);
        it(`${role}: ${allowed ? "renders the page" : "gets 'No access'"}`, async () => {
          as(role);
          const html = await renderPage(PAGE_FNS[page.key], sp());
          if (allowed) {
            expect(html).toContain(`${title(page.key)}</h1>`);
            expect(html).not.toContain("No access");
          } else {
            expect(html).toContain("No access");
            expect(html).not.toContain(`${title(page.key)}</h1>`);
          }
          expect(html).not.toContain("undefined");
          expect(html).not.toContain("NaN");
        });
      }
    });
  }
});

describe("pipeline page", () => {
  it("reads only the active branch's sites and shows sample rows labelled", async () => {
    as("branch_admin");
    const html = await renderPage(Pipeline, sp({ tab: "table" }));
    expect(callsMatching(/from pipeline_sites where branch_id/)[0][1]).toEqual(["pen"]);
    expect(html).toContain("84 Cox Avenue");
    expect(html).toContain("9 Sample Street");
    expect(html).toContain(">Sample</span>");
    expect(html).toContain("Rows marked Sample are invented");
  });

  it("hides sample rows entirely in Live only mode", async () => {
    as("branch_admin");
    jar.set("liveOnly", "1");
    const html = await renderPage(Pipeline, sp({ tab: "table" }));
    expect(html).toContain("84 Cox Avenue");
    expect(html).not.toContain("9 Sample Street");
    expect(html).not.toContain("Rows marked Sample");
  });

  it("opens the drawer for a site, with move and zoning forms for editors only", async () => {
    as("marketing");
    let html = await renderPage(Pipeline, sp({ site: "1" }));
    expect(html).toContain("Move to stage");
    expect(html).toContain("Confirm zoning");
    expect(html).toContain("Zoning TBC: confirm before acting");
    as("agent");
    html = await renderPage(Pipeline, sp({ site: "1" }));
    expect(html).toContain("84 Cox Avenue");
    expect(html).not.toContain("Move to stage");
  });

  it("does not offer zoning confirmation once confirmed", async () => {
    as("branch_admin");
    const html = await renderPage(Pipeline, sp({ site: "2" }));
    expect(html).not.toContain("Confirm zoning");
  });

  it("renders the snapshot tab from real rows only", async () => {
    as("branch_admin");
    const html = await renderPage(Pipeline, sp({ tab: "snapshot" }));
    expect(html).toContain("Weekly snapshot");
    expect(html).toContain("Approaches made (total)");
  });
});

describe("buyer page: masking and reveal", () => {
  const open = "sample-pen-0";

  it("shows the conversation list with sample status and the ribbon when no live log is configured", async () => {
    as("agent");
    const html = await renderPage(Buyer, sp());
    expect(html).toContain("SAMPLE DATA");
    expect(html).toContain("Showing sample conversations");
    expect(html).not.toContain("Source: ");
  });

  it("masks phone and email in the drawer until revealed, without writing an audit row", async () => {
    as("agent");
    const html = await renderPage(Buyer, sp({ c: open }));
    expect(html).not.toContain("0400 000 000");
    expect(html).not.toContain("sample@example.test");
    expect(html).toContain("•••");
    expect(html).toContain("Reveal");
    expect(sess.audit).not.toHaveBeenCalled();
  });

  it("reveal shows the contact details and writes a PII reveal audit row", async () => {
    as("agent");
    const html = await renderPage(Buyer, sp({ c: open, reveal: open }));
    expect(html).toContain("0400 000 000");
    expect(html).toContain("sample@example.test");
    expect(sess.audit).toHaveBeenCalledWith("agent@test.example", "PII reveal", expect.stringContaining(open), "prd", "pen");
  });

  it("a reveal parameter for a different conversation reveals nothing", async () => {
    as("agent");
    const html = await renderPage(Buyer, sp({ c: open, reveal: "sample-pen-1" }));
    expect(html).not.toContain("0400 000 000");
    expect(sess.audit).not.toHaveBeenCalled();
  });

  it("renders every tab", async () => {
    as("agent");
    for (const tab of ["conversations", "funnel", "handovers", "quality"]) expect(await renderPage(Buyer, sp({ tab }))).toContain("Buyer Sequencing");
  });

  it("hides everything that is not live in Live only mode", async () => {
    as("agent");
    jar.set("liveOnly", "1");
    const html = await renderPage(Buyer, sp());
    expect(html).not.toContain("SAMPLE DATA");
    expect(html).not.toContain("Conversations</h3>");
  });
});

describe("buyer page: live log", () => {
  it("shows Live with the outbound-held notice and no sample ribbon", async () => {
    vi.stubEnv("CONVERSATIONS_WEBHOOK_EMAIL", "ops@example.test");
    vi.stubEnv("CONVERSATIONS_WEBHOOK_KEY", "k");
    vi.stubEnv("N8N_BASE_URL", "https://n8n.test");
    const live = { generatedAt: "2026-10-06T00:00:00Z", sendingLive: false, totalConversations: 0, conversations: [] };
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => live })));
    as("agent");
    const html = await renderPage(Buyer, sp());
    expect(html).toContain("Real conversations from the conversation log");
    expect(html).toContain("Outbound sending is held");
    expect(html).not.toContain("SAMPLE DATA");
    expect(html).toContain("Source: n8n conversation log");
  });
});

describe("other data pages", () => {
  it("listings: sample for a non-Penrith branch, showing the ribbon", async () => {
    as("branch_admin", { branchId: "bm" });
    const html = await renderPage(Listings, sp());
    expect(html).toContain("SAMPLE DATA");
    expect(html).toContain("sample until the conversation log is connected");
  });

  it("listings: live when Vault answers", async () => {
    vi.stubEnv("VAULT_API_BASE_URL", "https://vault.test");
    vi.stubEnv("VAULT_API_KEY", "k");
    vi.stubEnv("VAULT_API_TOKEN", "t");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ items: [{ id: 1, status: "listing", address: { streetNumber: "1", street: "Real St", suburb: { name: "PENRITH" } } }] }) })));
    as("branch_admin");
    const html = await renderPage(Listings, sp());
    expect(html).toContain("1 Real St");
    expect(html).not.toContain("SAMPLE DATA");
  });

  it("map: passes every site to the map, and hides the (non-live) map card in Live only mode", async () => {
    as("branch_admin");
    const all = await renderPage(MapPage, sp());
    expect(JSON.parse(/<pre id="map-props">(.*?)<\/pre>/.exec(all)![1].replace(/&quot;/g, '"')).sites).toHaveLength(2);
    jar.set("liveOnly", "1");
    expect(await renderPage(MapPage, sp())).not.toContain("map-props");
  });

  it("audit: platform admins see everything, company admins their company, branch admins their branch", async () => {
    as("platform_admin");
    await renderPage(AuditPage, sp());
    expect(callsMatching(/from audit_log/)[0][0]).not.toContain("where");
    query.mockClear();
    as("company_admin");
    await renderPage(AuditPage, sp());
    expect(callsMatching(/from audit_log/)[0][1]).toEqual(["prd", null]);
    query.mockClear();
    as("branch_admin");
    await renderPage(AuditPage, sp());
    expect(callsMatching(/from audit_log/)[0][1]).toEqual(["prd", "pen"]);
  });

  it("feedback: only platform admins get the triage dropdown", async () => {
    as("platform_admin");
    expect(await renderPage(Feedback, sp())).toContain(">Save</button>");
    as("viewer");
    const html = await renderPage(Feedback, sp());
    expect(html).not.toContain(">Save</button>");
    expect(html).toContain("You said, we did");
  });

  it("progress: viewers cannot tick items, others can", async () => {
    as("viewer");
    expect(await renderPage(Progress, sp())).not.toContain("Mark done");
    as("agent");
    expect(await renderPage(Progress, sp())).toContain("Mark done");
  });

  it("sources and alerts degrade honestly when nothing is configured", async () => {
    as("branch_admin");
    const s = await renderPage(Sources, sp());
    expect(s).toContain("Not configured");
    const a = await renderPage(Alerts, sp());
    expect(a).toContain("Failure alerts are not yet delivered");
    expect(a).toContain("Needs: ");
  });

  it("exec, market, projects, meta, finance, pm, comm render with their page title for a platform admin", async () => {
    as("platform_admin");
    for (const k of ["exec", "market", "projects", "meta", "finance", "pm", "comm"]) expect(await renderPage(PAGE_FNS[k], sp())).toContain(title(k));
  });

  it("finance and meta always carry the sample ribbon", async () => {
    as("platform_admin");
    expect(await renderPage(Finance, sp())).toContain("SAMPLE DATA");
    expect(await renderPage(Meta, sp())).toContain("SAMPLE DATA");
  });

  it("users: a branch admin's role dropdown never offers platform or company admin", async () => {
    as("branch_admin");
    const html = await renderPage(Users, sp());
    expect(html).not.toContain(ROLE_LABEL.platform_admin + "</option>");
    expect(html).not.toContain(ROLE_LABEL.company_admin + "</option>");
    expect(html).toContain(ROLE_LABEL.viewer + "</option>");
    as("platform_admin");
    expect(await renderPage(Users, sp())).toContain(ROLE_LABEL.platform_admin + "</option>");
  });

  it("tasks: lists the branch's tasks and recent activity", async () => {
    as("agent");
    const html = await renderPage(Tasks, sp());
    expect(html).toContain("A task");
    expect(html).toContain("Recent activity");
    expect(callsMatching(/from tasks/)[0][1]).toEqual(["pen"]);
  });
});
