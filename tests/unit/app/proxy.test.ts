import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { config, proxy } from "@/proxy";
import { PAGES } from "@/lib/roles";

const req = (path: string, cookie?: string) => new NextRequest(`http://localhost:3000${path}`, cookie ? { headers: { cookie } } : undefined);
const passes = (r: Response) => r.headers.get("x-middleware-next") === "1";

describe("proxy: open paths", () => {
  it.each(["/login", "/login?error=x", "/api/auth/entra/login", "/api/auth/entra/callback?code=1", "/api/ingest/claim", "/_next/static/chunk.js", "/maplibre/maplibre-gl-worker.mjs", "/favicon.ico"])("lets %s through without a cookie", (p) => {
    expect(passes(proxy(req(p)))).toBe(true);
  });
});

describe("proxy: exact open-path matching", () => {
  it.each([
    "/login", "/login/", "/login/reset", "/maplibre/maplibre-gl-shared.mjs", "/api/auth/entra/login", "/api/auth/entra/callback",
    "/api/ingest/claim", "/api/ingest/turn", "/_next/static/a.js", "/_next/image", "/favicon.ico",
  ])("allows %s", (p) => expect(passes(proxy(req(p)))).toBe(true));

  it.each([
    "/loginx", "/login-evil", "/maplibre", "/maplibre/", "/maplibre-evil", "/maplibre/a/b", "/api/ingest", "/api/ingest/", "/api/ingestx", "/api/ingest/a/b",
    "/api/auth", "/api/auth/other", "/api/auth/entra", "/api/auth/entra/login/x", "/api/auth/entra/loginx", "/_nextx/a", "/favicon.icox",
  ])("blocks %s without a cookie", (p) => {
    const r = proxy(req(p));
    expect(r.status).toBe(307);
    expect(new URL(r.headers.get("location")!).pathname).toBe("/login");
  });

  it("lets a blocked path through with a session cookie", () => {
    expect(passes(proxy(req("/loginx", "prd_session=x")))).toBe(true);
  });
});

describe("proxy: protected paths", () => {
  it.each(["/", "/progress", "/buyer?tab=quality", "/users", "/api/anything-else", "/favicon.ico.bak"])("redirects %s to /login without a cookie", (p) => {
    const r = proxy(req(p));
    expect(r.status).toBe(307);
    expect(new URL(r.headers.get("location")!).pathname).toBe("/login");
  });

  it("redirects every dashboard page route without a cookie", () => {
    for (const page of PAGES) {
      const r = proxy(req(page.href));
      expect(r.status, page.href).toBe(307);
      expect(new URL(r.headers.get("location")!).pathname, page.href).toBe("/login");
    }
  });

  it("lets requests with a session cookie through (real checks happen server-side)", () => {
    for (const page of PAGES) expect(passes(proxy(req(page.href, "prd_session=anything")))).toBe(true);
  });

  it("ignores unrelated cookies", () => {
    expect(proxy(req("/progress", "other=1")).status).toBe(307);
  });
});

describe("proxy: matcher", () => {
  it("skips static assets and images", () => {
    const re = new RegExp(`^${config.matcher[0]}$`);
    expect(re.test("/progress")).toBe(true);
    expect(re.test("/_next/static/x.js")).toBe(false);
    expect(re.test("/_next/image")).toBe(false);
    expect(re.test("/logo.png")).toBe(false);
  });
});
