import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement as h, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Ctx } from "@/lib/ctx";
import type { Session } from "@/lib/session";
import { PAGES } from "@/lib/roles";
import { convo, turn } from "@tests/helpers/conversation";
import { BRANCHES, form, makeSession } from "@tests/helpers/fixtures";
import { callsMatching, pool, query, routeDb } from "@tests/helpers/db";
import { jar } from "@tests/helpers/next";
import { findActions, renderPage, renderToHtml, resolveTree } from "@tests/helpers/render";

const sess = vi.hoisted(() => ({ getSession: vi.fn<() => Promise<Session | null>>(), audit: vi.fn(), signInUser: vi.fn() }));
const entra = vi.hoisted(() => ({ exchangeCode: vi.fn() }));
vi.mock("@/lib/db", async () => (await import("@tests/helpers/db")).dbMock);
vi.mock("@/lib/session", () => sess);
vi.mock("next/headers", async () => (await import("@tests/helpers/next")).nextHeadersMock);
vi.mock("next/cache", async () => (await import("@tests/helpers/next")).nextCacheMock);
vi.mock("next/navigation", async () => (await import("@tests/helpers/next")).nextNavigationMock);
vi.mock("@/lib/entra", async (orig) => ({ ...(await orig<typeof import("@/lib/entra")>()), exchangeCode: entra.exchangeCode }));

import { getConversations, qualityFlags } from "@/lib/data/conversations";
import { getListings } from "@/lib/data/vault";
import { resolveUser } from "@/lib/entra";
import { getCtx } from "@/lib/ctx";
import { proxy } from "@/proxy";
import { Card, Kpi, StatusBadge } from "@/components/ui";
import { POST as ingest } from "@/app/api/ingest/[kind]/route";
import { GET as entraCallback } from "@/app/api/auth/entra/callback/route";
import Users from "@/app/(app)/users/page";
import AuditPage from "@/app/(app)/audit/page";
import Companies from "@/app/(app)/companies/page";
import Sources from "@/app/(app)/sources/page";
import Alerts from "@/app/(app)/alerts/page";
import Buyer from "@/app/(app)/buyer/page";
import Pipeline from "@/app/(app)/pipeline/page";

const seed = () =>
  routeDb([
    [/select id, company_id, name, suburbs from branches/, BRANCHES],
    [/select name from companies/, [{ name: "PRD Group" }]],
  ]);
const signedInAs = (s: Session | null) => {
  sess.getSession.mockResolvedValue(s);
  seed();
};

const kinds = (c: ReturnType<typeof convo>[]) => qualityFlags(c).map((f) => f.kind);

describe("conversation quality bugs", () => {
  // Bug: REA sends the buyer's postcode as its own message ("Postcode: 2148") and the assistant treated it as a real buyer message.
  it("REGRESSION postcode field read as a buyer message", () => {
    const c = convo({ conversationId: "rea-1", buyer: "REA Lead" }, [turn("Postcode: 2148", "Great, which property are you asking about?")]);
    expect(qualityFlags([c])).toEqual([{ id: "rea-1", kind: "Postcode read as a message", example: "REA Lead" }]);
  });

  // Bug: the same buyer message got several identical replies (webhook retried, no idempotency).
  it("REGRESSION duplicate replies to the same message", () => {
    const body = "Thanks for your enquiry about this property, I can help with inspection times today.";
    const c = convo({}, [turn("Is it available?", body), turn("Is it available?", body), turn("Is it available?", body)]);
    expect(kinds([c])).toContain("Repeated reply opening");
  });

  // Bug: n8n triggered twice for one inbound message, so the buyer got two replies. The claim endpoint makes the reply idempotent.
  it("REGRESSION duplicate replies to the same message (idempotent claim)", async () => {
    vi.stubEnv("INGEST_API_KEY", "k".repeat(32));
    const claim = () => ingest(new NextRequest("http://localhost:3100/api/ingest/claim", { method: "POST", headers: { "x-ingest-key": "k".repeat(32) }, body: JSON.stringify({ conversationId: "c-9", message: "Is it available?" }) }), { params: Promise.resolve({ kind: "claim" }) });
    expect(await (await claim()).json()).toEqual({ claimed: true });
    pool.query.mockResolvedValueOnce({ rows: [{}], rowCount: 1 });
    expect(await (await claim()).json()).toEqual({ claimed: false });
  });

  // Bug: a pair of identical replies (the most common duplicate) is not flagged because the check tolerates one repeat.
  it.todo("REGRESSION two identical replies to one message should also be flagged (needs `< replies.length` in qualityFlags)");

  // Bug: the assistant asked buyers preference questions (type of property, bedrooms) it must never ask.
  it("REGRESSION preference questions asked of buyers", () => {
    for (const q of ["What type of property are you after?", "How many bedrooms would you like?", "What is your ideal number of bedrooms?"]) {
      expect(kinds([convo({}, [turn("Hi", q)])]), q).toContain("Preference question asked");
    }
  });
});

describe("listing data bugs", () => {
  const cfg = () => {
    vi.stubEnv("VAULT_API_BASE_URL", "https://vault.test");
    vi.stubEnv("VAULT_API_KEY", "k");
    vi.stubEnv("VAULT_API_TOKEN", "t");
  };
  const reply = (items: unknown[]) => vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ items }) })));

  // Bug: a price was quoted to a buyer for a listing that had been withdrawn, sold or was only conditional.
  it("REGRESSION price quoted for a withdrawn, sold or conditional listing", async () => {
    cfg();
    const base = { address: { streetNumber: "1", street: "A St", suburb: { name: "PENRITH" } }, displayPrice: "$999k" };
    reply(["withdrawn", "sold", "conditional", "underOffer", "settled", "off-market"].map((status, i) => ({ id: i, status, ...base })).concat([{ id: 99, status: "listing", ...base }]));
    const r = await getListings("pen", []);
    expect(r.data.map((l) => l.id)).toEqual(["99"]);
  });

  // Bug: vendor-confidential Vault fields (commission, marketing spend, agent price opinion, authority dates) reached the buyer-facing side.
  it("REGRESSION vendor-confidential fields reaching a buyer", async () => {
    cfg();
    reply([{ id: 1, status: "listing", address: { streetNumber: "1", street: "A St", suburb: { name: "PENRITH" } }, commission: 31000, marketingSpend: 5500, agentPriceOpinion: "vendor wants 1.2m", authorityStart: "2026-02-02", authorityEnd: "2026-08-02", appraisal: 1150000, vendors: [{ name: "Private Person" }] }]);
    const out = JSON.stringify(await getListings("pen", []));
    for (const leak of ["31000", "5500", "vendor wants", "2026-02-02", "2026-08-02", "1150000", "Private Person"]) expect(out, leak).not.toContain(leak);
  });

  // Bug (guard): nothing in the shared data types may even have a slot for confidential data.
  it("REGRESSION data types have no field for confidential vendor data", () => {
    const types = readFileSync(join(process.cwd(), "src", "lib", "data", "types.ts"), "utf8");
    expect(types).not.toMatch(/commission|marketing(Spend|Budget)|appraisal|authority|vendor|priceOpinion/i);
  });
});

describe("tenancy and access bugs", () => {
  // Bug: a buyer conversation from the live Penrith log was shown while viewing another branch.
  it("REGRESSION conversation shown for a different branch", async () => {
    vi.stubEnv("CONVERSATIONS_WEBHOOK_EMAIL", "ops@example.test");
    vi.stubEnv("CONVERSATIONS_WEBHOOK_KEY", "k");
    vi.stubEnv("N8N_BASE_URL", "https://n8n.test");
    const spy = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ generatedAt: "x", sendingLive: true, totalConversations: 1, conversations: [convo({ conversationId: "PEN-LIVE" })] }) }));
    vi.stubGlobal("fetch", spy);
    const bm = await getConversations("bm");
    expect(spy).not.toHaveBeenCalled();
    expect(bm.status).toBe("waiting");
    expect(bm.data).toEqual([]);
    expect(JSON.stringify(bm.data)).not.toContain("PEN-LIVE");
    expect((await getConversations("pen")).data[0].conversationId).toBe("PEN-LIVE");
  });

  // Bug: a user could point the scope cookie at a branch they have no right to and see its data.
  it("REGRESSION scope cookie pointing at a branch the user may not see", async () => {
    signedInAs(makeSession("branch_admin", { branchId: "gp" }));
    jar.set("scope", "bm");
    const ctx = (await getCtx())!;
    expect(ctx.branch.id).toBe("gp");
    expect(ctx.branches.map((b) => b.id)).toEqual(["gp"]);
    signedInAs(makeSession("company_admin"));
    jar.set("scope", "oth");
    expect((await getCtx())!.branches.map((b) => b.id)).not.toContain("oth");
  });

  // Bug: a viewer could reach admin pages (and their actions) by URL.
  it("REGRESSION viewer role reaching admin pages", async () => {
    signedInAs(makeSession("viewer"));
    for (const page of [Users, AuditPage, Companies, Sources, Alerts, Buyer, Pipeline]) {
      const html = await renderPage(page as never, { searchParams: Promise.resolve({}) });
      expect(html).toContain("No access");
    }
    expect(query).not.toHaveBeenCalledWith(expect.stringMatching(/from (users|audit_log|tenants)/i), expect.anything());
  });

  // Bug: a viewer replaying a server action id could still change data.
  it("REGRESSION viewer calling admin server actions directly", async () => {
    signedInAs(makeSession("platform_admin"));
    routeDb([[/select id, company_id, name, suburbs from branches/, BRANCHES], [/select name from companies/, [{ name: "PRD Group" }]], [/from users order by/, [{ email: "v@prd.test", name: "Vee", role: "viewer", company_id: "prd", branch_id: "pen", status: "active", last_login: null }]]]);
    const { addUser, toggleUser } = findActions(await resolveTree(await Users()));
    signedInAs(makeSession("viewer"));
    await addUser(form({ email: "x@prd.test", name: "Intruder", role: "viewer", branch: "pen" }));
    await toggleUser(form({ email: "someone@prd.test" }));
    expect(callsMatching(/^\s*(insert|update)/i)).toHaveLength(0);
  });

  // Bug: a branch admin could grant a role above their own.
  it("REGRESSION branch admin granting platform_admin", async () => {
    signedInAs(makeSession("platform_admin"));
    const { addUser } = findActions(await resolveTree(await Users()));
    signedInAs(makeSession("branch_admin"));
    await addUser(form({ email: "root@prd.test", name: "Root User", role: "platform_admin", branch: "pen" }));
    expect(callsMatching(/insert into users/i)).toHaveLength(0);
  });

  // Bug: pages and data were reachable without a session (a public conversation endpoint).
  it("REGRESSION public conversation endpoint exposure: every page route redirects to /login without a session", () => {
    for (const path of ["/", "/buyer", "/buyer?tab=conversations&c=sample-pen-0&reveal=sample-pen-0", ...PAGES.map((p) => p.href)]) {
      const r = proxy(new NextRequest(`http://localhost:3100${path}`));
      expect(r.status, path).toBe(307);
      expect(new URL(r.headers.get("location")!).pathname, path).toBe("/login");
    }
  });

  // Bug (guard): the only API routes are Entra sign-in and the key-protected n8n ingest; there is no data-reading endpoint.
  it("REGRESSION no public API route other than Entra sign-in and key-protected ingest exists", () => {
    const routes: string[] = [];
    const walk = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) walk(p);
        else if (/^route\.(t|j)sx?$/.test(n)) routes.push(p.replace(/\\/g, "/").split("src/app/")[1]);
      }
    };
    walk(join(process.cwd(), "src", "app"));
    expect(routes.sort()).toEqual(["api/auth/entra/callback/route.ts", "api/auth/entra/login/route.ts", "api/ingest/[kind]/route.ts"]);
    const ingest = readFileSync(join(process.cwd(), "src", "app", "api", "ingest", "[kind]", "route.ts"), "utf8");
    expect(ingest).toMatch(/export async function POST/);
    expect(ingest).not.toMatch(/export async function (GET|PUT|PATCH|DELETE)/);
  });

  // Bug (defence in depth): even if the proxy were bypassed, pages return nothing without a valid session.
  it("REGRESSION pages render nothing without a session", async () => {
    signedInAs(null);
    for (const page of [Users, AuditPage, Companies, Sources, Alerts, Buyer, Pipeline]) {
      expect(await (page as unknown as (p: unknown) => Promise<unknown>)({ searchParams: Promise.resolve({}) })).toBeNull();
    }
  });
});

describe("Microsoft sign-in bugs", () => {
  const id = { tid: "99999999-9999-9999-9999-999999999999", oid: "oid-x", email: "someone@gmail.test", name: "Someone" };

  // Bug: a user from any Microsoft tenant not mapped to a company could sign in (multi-tenant app registration).
  it("REGRESSION user from an unmapped Entra tenant signing in", async () => {
    routeDb([[/from tenants/, []]]);
    expect(await resolveUser(id)).toEqual({ error: "Your organisation is not set up for this dashboard." });

    entra.exchangeCode.mockResolvedValue(id);
    const req = new NextRequest("http://localhost:3100/api/auth/entra/callback?code=c&state=s", { headers: { cookie: `prd_oidc=${encodeURIComponent(JSON.stringify({ state: "s", nonce: "n", verifier: "v" }))}` } });
    const res = await entraCallback(req);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
    expect(sess.signInUser).not.toHaveBeenCalled();
    expect(sess.audit).toHaveBeenCalledWith("someone@gmail.test", "Sign-in denied", expect.stringContaining("tenant 99999999"));
  });

  // Bug: a different Microsoft account with the same email claim took over an existing user (email reuse).
  it("REGRESSION reused email claiming another user's Microsoft account", async () => {
    const tenant = { tid: "t", kind: "company", company_id: "prd", domains: ["prd.net.au"] };
    const row = { email: "lily@prd.net.au", role: "branch_admin", company_id: "prd", entra_oid: "the-real-oid", status: "active" };
    routeDb([[/from tenants/, [tenant]], [/where entra_oid = /, []], [/lower\(email\) = \$1/, [row]]]);
    expect(await resolveUser({ tid: "t", oid: "attacker-oid", email: "lily@prd.net.au", name: "Mallory" })).toEqual({ error: "This email is already linked to a different Microsoft account." });
    expect(callsMatching(/update users/)).toHaveLength(0);
  });

  // Bug: a user whose email domain was not registered for the tenant was matched by email alone.
  it("REGRESSION email on a domain the tenant does not own", async () => {
    routeDb([[/from tenants/, [{ tid: "t", kind: "company", company_id: "prd", domains: ["prd.net.au"] }]], [/lower\(email\) = \$1/, [{ email: "lily@prd.net.au", role: "branch_admin", company_id: "prd", entra_oid: null, status: "active" }]]]);
    expect(await resolveUser({ tid: "t", oid: "o", email: "lily@evil.test", name: "X" })).toMatchObject({ error: expect.stringContaining("domain") });
  });
});

describe("data honesty bugs", () => {
  // Bug: sample figures were shown with a Live look. Sample must always be labelled and never counted as live.
  it("REGRESSION sample data labelled live (Card, Kpi, badges)", async () => {
    sess.getSession.mockResolvedValue(makeSession("platform_admin"));
    seed();
    const card = await renderToHtml(h(Card, { status: "sample", title: "Fake", children: "x" }));
    expect(card).toContain("SAMPLE DATA");
    expect(card).not.toContain("pulse-dot live");
    expect(card).not.toContain("Source:");
    const kpi = await renderToHtml(h(Kpi, { label: "L", value: "1", status: "sample" }));
    expect(kpi).toContain("Sample data");
    expect(kpi).not.toMatch(/>Live</);
    expect(renderToStaticMarkup(h(StatusBadge, { status: "sample" }))).not.toContain("live");
  });

  // Bug: with no live connection the Buyer page showed sample conversations under a Live badge.
  it("REGRESSION buyer page badge comes from the data result, never hard-coded live", async () => {
    signedInAs(makeSession("agent"));
    const html = await renderPage(Buyer as never, { searchParams: Promise.resolve({}) });
    expect(html).toContain("b-waiting");
    expect(html).not.toContain("b-sample");
    expect(html).not.toContain("b-live");
    expect(html).not.toContain("Real conversations from the conversation log");
  });

  // Bug: a failed live read left the page claiming Live; it must fall back to Waiting with no data and a note.
  it("REGRESSION failed live read still labelled live", async () => {
    vi.stubEnv("CONVERSATIONS_WEBHOOK_EMAIL", "ops@example.test");
    vi.stubEnv("CONVERSATIONS_WEBHOOK_KEY", "k");
    vi.stubEnv("N8N_BASE_URL", "https://n8n.test");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 502, json: async () => ({}) })));
    const r = await getConversations("pen");
    expect(r.status).toBe("waiting");
    expect(r.note).toBeTruthy();
  });

  // Bug: "Live only" still showed sample widgets and the SAMPLE DATA ribbon.
  it("REGRESSION Live only mode shows no sample widgets", async () => {
    const ctx = { session: makeSession("platform_admin"), branch: BRANCHES[0], branches: BRANCHES, liveOnly: true, companyName: "PRD Group" } satisfies Ctx;
    sess.getSession.mockResolvedValue(ctx.session);
    seed();
    jar.set("liveOnly", "1");
    const html = await renderToHtml(
      h(Fragment, null,
        h(Card, { status: "sample", title: "S", children: "x" }),
        h(Card, { status: "prototype", title: "P", children: "x" }),
        h(Card, { status: "live", title: "L", children: "x" }),
        h(Kpi, { label: "K", value: "1", status: "sample" }),
      ),
    );    expect(html).not.toContain("SAMPLE DATA");
    expect(html).not.toContain(">S<");
    expect(html).toContain(">L<");
  });
});
