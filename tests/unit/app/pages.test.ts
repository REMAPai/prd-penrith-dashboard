import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PAGES, ROLE_LABEL, canSee, type Role } from "@/lib/roles";
import type { Session } from "@/lib/session";
import type { Conversation } from "@/lib/data/types";
import { BRANCHES, ROLES, makeSession } from "@tests/helpers/fixtures";
import { callsMatching, query, routeDb } from "@tests/helpers/db";
import { jar } from "@tests/helpers/next";
import { renderPage } from "@tests/helpers/render";

const sess = vi.hoisted(() => ({ getSession: vi.fn<() => Promise<Session | null>>(), audit: vi.fn() }));
vi.mock("@/lib/db", async () => (await import("@tests/helpers/db")).dbMock);
vi.mock("@/lib/session", () => sess);
const conv = vi.hoisted(() => ({ override: null as null | (() => unknown) }));
vi.mock("@/lib/data/conversations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data/conversations")>();
  return { ...actual, getConversations: (branchId: string) => (conv.override ? conv.override() : actual.getConversations(branchId)) };
});
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
  { id: 1, branch_id: "pen", lga: "Penrith", address: "1 Test Street", suburb: "Testville", zoning: "Other", zoning_confirmed: true, zoning_source: "Test map service", zone_code: "E4", zone_name: "Test zone", lot_size: null, stage: 0, priority: null, signal: null, da_number: "DA99/0001", da_type: "DA", da_status: "In Assessment", source: "NSW Planning Portal", assignee: null, next_step: null, notes: "Test note from the sheet", is_sample: false, identified_on: "2026-10-08", stage_changed_at: "2026-10-08T00:00:00Z", lat: -33.75, lng: 150.69, site_kind: "da", applicant: "Test Applicant Pty Ltd", abn: null, contact_found: "Not yet found", action_taken: "Researching", flag: "NEW" },
  { id: 2, branch_id: "pen", lga: "Penrith", address: "2 Test Street", suburb: "Testville", zoning: "TBC", zoning_confirmed: false, zoning_source: null, zone_code: null, zone_name: null, lot_size: null, stage: 0, priority: null, signal: null, da_number: "CDC-0002", da_type: "CDC", da_status: null, source: "NSW Planning Portal", assignee: null, next_step: null, notes: null, is_sample: false, identified_on: "2026-10-08", stage_changed_at: "2026-10-08T00:00:00Z", lat: -33.76, lng: 150.7, site_kind: "da", applicant: null, abn: null, contact_found: null, action_taken: null, flag: "NEW" },
];
const weekRows = [{ week_start: "2026-10-05", run_at: "2026-10-05T07:00:00Z", rows_total: 2, items: 2 }, { week_start: "2026-09-28", run_at: "2026-09-28T07:00:00Z", rows_total: 1, items: 1 }];
const companyRows = [{ name: "Test Applicant Pty Ltd", linked_address: "1 Test Street", acn_abn: "", asic_done: "", directors: "", role: "", contact_details: "", source_used: "", notes: "" }];
const userRows = [{ email: "v@prd.test", name: "Vee", role: "viewer", company_id: "prd", branch_id: "pen", status: "active", last_login: null }];

const seedDb = () =>
  routeDb([
    [/join companies c/, [{ company: "PRD Group", entra: true, branch: "Penrith", suburbs: ["Penrith"], users: "3" }]],
    [/from tenants t/, [{ tid: "7b712bf0-a681-4071-adb1-fd3b7cdd4238", name: "REMAP.ai", kind: "platform", domains: ["remap.ai"], users: "1" }]],
    [/select id, company_id, name, suburbs from branches/, BRANCHES],
    [/select name from companies/, [{ name: "PRD Group" }]],
    [/from playbook_weeks/, weekRows],
    [/from playbook_week_items/, sites],
    [/from playbook_companies/, companyRows],
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

describe("Development Playbook page", () => {
  it("reads the active branch's weeks and sites and shows the sheet's fields", async () => {
    as("branch_admin");
    const html = await renderPage(Pipeline, sp({ tab: "table" }));
    expect(callsMatching(/from playbook_weeks/)[0][1]).toEqual(["pen"]);
    expect(callsMatching(/from pipeline_sites s where/)[0][1]).toEqual(["pen"]);
    expect(html).toContain("Development Playbook");
    expect(html).toContain("DA99/0001");
    expect(html).toContain("Test Applicant Pty Ltd");
    expect(html).toContain("Not yet found");
    expect(html).not.toContain("Data under testing");
  });

  it("shows a week bar with each week's date range and defaults to the latest run", async () => {
    as("branch_admin");
    const html = await renderPage(Pipeline, sp({ tab: "table" }));
    expect(html).toContain("5 Oct to 11 Oct 2026");
    expect(html).toContain("28 Sep to 4 Oct 2026");
    expect(html).toContain("All weeks");
    expect(callsMatching(/from playbook_week_items i join pipeline_sites/)[0][1]).toEqual(["pen", "2026-10-05"]);
  });

  it("opens the week in the URL, ignoring one that has no run", async () => {
    as("branch_admin");
    await renderPage(Pipeline, sp({ tab: "table", week: "2026-09-28" }));
    expect(callsMatching(/from playbook_week_items i join pipeline_sites/).at(-1)![1]).toEqual(["pen", "2026-09-28"]);
    await renderPage(Pipeline, sp({ tab: "table", week: "2020-01-06" }));
    expect(callsMatching(/from playbook_week_items i join pipeline_sites/).at(-1)![1]).toEqual(["pen", "2026-10-05"]);
  });

  it("explains why a value is missing instead of leaving it blank or guessing", async () => {
    as("branch_admin");
    const html = await renderPage(Pipeline, sp({ tab: "table" }));
    expect(html).toContain("Not available");
    expect(html).toContain("CDCs are not in the council tracker, so there is no applicant name.");
    expect(html).toContain("No ABN or ACN in the sheet yet.");
  });

  it("says so when no weekly run has arrived", async () => {
    as("branch_admin");
    routeDb([[/select name from companies/, [{ name: "PRD Group" }]], [/select id, company_id, name, suburbs from branches/, BRANCHES]]);
    const html = await renderPage(Pipeline, sp({ tab: "table" }));
    expect(html).toContain("No weekly run has reached the dashboard yet");
    expect(html).toContain("No applications for this selection.");
  });

  it("opens the drawer for an application, with move and zoning forms for editors only", async () => {
    as("marketing");
    let html = await renderPage(Pipeline, sp({ site: "2" }));
    expect(html).toContain("Move to stage");
    expect(html).toContain("Confirm zoning");
    expect(html).toContain("Zoning TBC: confirm before acting");
    as("agent");
    html = await renderPage(Pipeline, sp({ site: "2" }));
    expect(html).toContain("2 Test Street");
    expect(html).not.toContain("Move to stage");
  });

  it("shows the sheet's notes and the zone source for a confirmed row, without a zoning form", async () => {
    as("branch_admin");
    const html = await renderPage(Pipeline, sp({ site: "1" }));
    expect(html).toContain("Test note from the sheet");
    expect(html).toContain("Test map service");
    expect(html).toContain("E4");
    expect(html).not.toContain("Confirm zoning");
  });

  it("counts the snapshot the way the sheet does, by Date Identified inside the week", async () => {
    as("branch_admin");
    const html = await renderPage(Pipeline, sp({ tab: "snapshot", week: "2026-10-05" }));
    expect(html).toContain("Weekly snapshot");
    expect(html).toContain("New DAs identified");
    expect(html).toContain("Owner or director contact still needed");
    expect(html).toContain("The Zoning Farm List is filled by hand");
  });

  it("lists the companies tab and says what is not researched yet", async () => {
    as("branch_admin");
    const html = await renderPage(Pipeline, sp({ tab: "companies" }));
    expect(callsMatching(/from playbook_companies/)[0][1]).toEqual(["prd"]);
    expect(html).toContain("Test Applicant Pty Ltd");
    expect(html).toContain("Not yet researched");
  });

  it("lists what the sheet does not hold, with the reason", async () => {
    as("branch_admin");
    const html = await renderPage(Pipeline, sp({ tab: "gaps" }));
    expect(html).toContain("Data not in the sheet");
    expect(html).toContain("The sheet has no priority column");
    expect(html).toContain("no coordinates");
  });
});

const open = "live-pen-0";
const liveConversation: Conversation = {
  conversationId: open, buyer: "Test Buyer", phone: "0400 000 000", email: "buyer@example.test", property: "1 Test St", source: "Test", agent: "Test Agent",
  temperature: "Hot", buyerType: "Owner occupier", financeStatus: "pre_approved", needsToSellFirst: "no", timeframe: "now", inspection: "not_discussed",
  wantsContract: false, consent: "yes", readyForAgent: false, whyReady: "", afterHours: false, startedAt: "2026-10-05T00:00:00Z", lastAt: "2026-10-05T00:05:00Z",
  date: "2026-10-05", turns: [{ at: "2026-10-05T00:00:00Z", buyer: "Hi", assistant: "Hello", replyAt: "2026-10-05T00:01:00Z" }], handoffStatus: "none", slaDueAt: null,
};
const withLiveLog = () => { conv.override = async () => ({ status: "live", data: [liveConversation], source: "Test conversation log", asOf: "2026-10-05T00:05:00Z", sendingLive: false }); };
afterEach(() => { conv.override = null; });

describe("buyer page: masking and reveal", () => {
  it("shows waiting status and no conversations when no live log is configured", async () => {
    as("agent");
    const html = await renderPage(Buyer, sp());
    expect(html).toContain("No conversations yet: the live log is not connected.");
    expect(html).not.toContain("SAMPLE DATA");
    expect(html).not.toContain("Showing sample conversations");
    expect(html).not.toContain("Test Buyer");
    expect(html).not.toContain("Source: ");
  });

  it("lists live conversations when the log is connected", async () => {
    withLiveLog();
    as("agent");
    const html = await renderPage(Buyer, sp());
    expect(html).toContain("Test Buyer");
    expect(html).toContain("Real conversations from the conversation log");
  });

  it("masks phone and email in the drawer until revealed, without writing an audit row", async () => {
    withLiveLog();
    as("agent");
    const html = await renderPage(Buyer, sp({ c: open }));
    expect(html).not.toContain("0400 000 000");
    expect(html).not.toContain("buyer@example.test");
    expect(html).toContain("•••");
    expect(html).toContain("Reveal");
    expect(sess.audit).not.toHaveBeenCalled();
  });

  it("reveal shows the contact details and writes a PII reveal audit row", async () => {
    withLiveLog();
    as("agent");
    const html = await renderPage(Buyer, sp({ c: open, reveal: open }));
    expect(html).toContain("0400 000 000");
    expect(html).toContain("buyer@example.test");
    expect(sess.audit).toHaveBeenCalledWith("agent@test.example", "PII reveal", expect.stringContaining(open), "prd", "pen");
  });

  it("a reveal parameter for a different conversation reveals nothing", async () => {
    withLiveLog();
    as("agent");
    const html = await renderPage(Buyer, sp({ c: open, reveal: "live-pen-1" }));
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
    as("agent");
    const seeded = query.getMockImplementation()!;
    const convRoutes: [RegExp, unknown[]][] = [[/from buyer_conversations/, [{ conversation_id: "c1", enquiry_id: "e1", buyer: "Pat", phone: "0400", email: "p@example.test", property: "1 A St", source: "REA", agent: "", temperature: "Hot", buyer_type: "Investor", finance_status: "", needs_to_sell_first: "", timeframe: "", inspection: "", wants_contract: false, consent: "Yes", ready_for_agent: false, why_ready: "", handoff_status: "none", sla_due_at: null, after_hours: false, started_at: new Date("2026-10-06T00:00:00Z"), last_at: new Date("2026-10-06T00:00:00Z") }]], [/from buyer_turns/, []]];
    query.mockImplementation(async (sql, params) => { for (const [re, out] of convRoutes) if (re.test(sql)) return out; return seeded(sql, params); });
    const html = await renderPage(Buyer, sp());
    expect(html).toContain("Real conversations from the conversation log");
    expect(html).toContain("Outbound sending is held");
    expect(html).not.toContain("SAMPLE DATA");
    expect(html).toContain("Dashboard database, written by n8n on every turn");
  });
});

describe("other data pages", () => {
  it("listings: waiting with no data for a non-Penrith branch, and no sample ribbon", async () => {
    as("branch_admin", { branchId: "bm" });
    const html = await renderPage(Listings, sp());
    expect(html).not.toContain("SAMPLE DATA");
    expect(html).toContain("Vault listings are only connected for the Penrith branch.");
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

  it("finance and meta show a waiting notice and no sample ribbon", async () => {
    as("platform_admin");
    const fin = await renderPage(Finance, sp());
    expect(fin).toContain("No financial data has been shared with us yet");
    expect(fin).not.toContain("SAMPLE DATA");
    const meta = await renderPage(Meta, sp());
    expect(meta).toContain("Weekly figures need read access to the Meta leads sheet");
    expect(meta).not.toContain("SAMPLE DATA");
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
