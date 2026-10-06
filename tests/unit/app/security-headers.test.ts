import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "../../../next.config";

const headersFor = async () => {
  const rules = await nextConfig.headers!();
  expect(rules).toHaveLength(1);
  expect(rules[0].source).toBe("/:path*");
  return Object.fromEntries(rules[0].headers.map((h) => [h.key, h.value]));
};
const directive = (csp: string, name: string) => csp.split("; ").find((d) => d.startsWith(`${name} `));

afterEach(() => vi.unstubAllEnvs());

describe("next.config security headers", () => {
  it("sets the fixed security headers on all routes", async () => {
    const h = await headersFor();
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Permissions-Policy"]).toBe("camera=(), microphone=(), geolocation=()");
  });

  it("builds a CSP that allows the app, MapLibre worker, CARTO tiles and Google Fonts only", async () => {
    const csp = (await headersFor())["Content-Security-Policy"];
    expect(directive(csp, "default-src")).toBe("default-src 'self'");
    expect(directive(csp, "worker-src")).toBe("worker-src 'self' blob:");
    expect(directive(csp, "img-src")).toBe("img-src 'self' data: blob: https://*.basemaps.cartocdn.com");
    expect(directive(csp, "connect-src")).toBe("connect-src 'self' https://*.basemaps.cartocdn.com");
    expect(directive(csp, "style-src")).toContain("https://fonts.googleapis.com");
    expect(directive(csp, "font-src")).toContain("https://fonts.gstatic.com");
    for (const d of ["frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'"]) expect(csp).toContain(d);
  });

  it("allows unsafe-eval only in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(directive((await headersFor())["Content-Security-Policy"], "script-src")).toBe("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
    vi.stubEnv("NODE_ENV", "production");
    expect(directive((await headersFor())["Content-Security-Policy"], "script-src")).toBe("script-src 'self' 'unsafe-inline'");
  });

  it("sends Strict-Transport-Security only in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect((await headersFor())["Strict-Transport-Security"]).toMatch(/^max-age=\d+/);
    vi.stubEnv("NODE_ENV", "development");
    expect((await headersFor())["Strict-Transport-Security"]).toBeUndefined();
  });
});
