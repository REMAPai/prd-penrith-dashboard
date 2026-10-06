import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { PAGES, ROLE_LABEL, canSee } from "@/lib/roles";
import { ROLES, makeCtx } from "@tests/helpers/fixtures";
import { renderPage } from "@tests/helpers/render";
import { RedirectError } from "@tests/helpers/next";
import type { Ctx } from "@/lib/ctx";
import type { Session } from "@/lib/session";

const ctxMock = vi.hoisted(() => ({ getCtx: vi.fn<() => Promise<Ctx | null>>() }));
const sess = vi.hoisted(() => ({ getSession: vi.fn<() => Promise<Session | null>>() }));
vi.mock("@/lib/ctx", () => ctxMock);
vi.mock("@/lib/session", () => sess);
vi.mock("next/navigation", async () => (await import("@tests/helpers/next")).nextNavigationMock);
vi.mock("next/font/google", () => ({ Poppins: () => ({ variable: "poppins-var" }) }));
vi.mock("@/app/login/actions", () => ({ signOut: vi.fn(), passwordLogin: vi.fn() }));
vi.mock("@/components/TopControls", () => ({
  LiveToggle: (p: { liveOnly: boolean }) => createElement("div", { id: "live-toggle", "data-live": String(p.liveOnly) }),
  ScopeSelect: (p: { branches: { id: string }[] }) => createElement("div", { id: "scope", "data-n": p.branches.length }),
}));
vi.mock("@/app/login/LoginForm", () => ({ default: () => createElement("div", { id: "login-form" }) }));

import AppLayout from "@/app/(app)/layout";
import LoginPage from "@/app/login/page";
import Home from "@/app/page";
import RootLayout, { metadata } from "@/app/layout";

const kids = createElement("p", null, "CHILD");

describe("app layout", () => {
  it("redirects to /login when there is no session", async () => {
    ctxMock.getCtx.mockResolvedValue(null);
    await expect(AppLayout({ children: kids })).rejects.toBeInstanceOf(RedirectError);
  });

  for (const role of ROLES) {
    it(`${role}: sidebar lists exactly the pages that role may see, with the user's name and role`, async () => {
      ctxMock.getCtx.mockResolvedValue(makeCtx(role));
      const html = await renderPage(AppLayout as never, { children: kids });
      for (const p of PAGES) {
        const hrefTag = `href="${p.href}"`;
        if (canSee(role, p)) expect(html, p.key).toContain(hrefTag);
        else expect(html, p.key).not.toContain(`${hrefTag} class="item`);
      }
      expect(html).toContain("CHILD");
      expect(html).toContain(`Test ${role}`);
      expect(html).toContain(ROLE_LABEL[role]);
      expect(html).toContain('href="/feedback" class="fab"');
    });
  }

  it("viewers see fewer pages than platform admins, and branch admins never see the platform group", async () => {
    ctxMock.getCtx.mockResolvedValue(makeCtx("viewer"));
    const v = await renderPage(AppLayout as never, { children: kids });
    ctxMock.getCtx.mockResolvedValue(makeCtx("branch_admin"));
    const b = await renderPage(AppLayout as never, { children: kids });
    ctxMock.getCtx.mockResolvedValue(makeCtx("platform_admin"));
    const p = await renderPage(AppLayout as never, { children: kids });
    expect((v.match(/class="item/g) ?? []).length).toBe(3);
    expect(b).not.toContain("Platform</div>");
    expect(p).toContain("Platform</div>");
    expect((p.match(/class="item/g) ?? []).length).toBe(PAGES.length);
  });

  it("passes the live-only flag and scope branches to the top bar", async () => {
    ctxMock.getCtx.mockResolvedValue(makeCtx("platform_admin", { liveOnly: true }));
    const html = await renderPage(AppLayout as never, { children: kids });
    expect(html).toContain('data-live="true"');
    expect(html).toContain('data-n="4"');
  });
});

describe("login page", () => {
  const sp = (error?: string) => ({ searchParams: Promise.resolve({ error }) });

  it("redirects signed-in users to /progress", async () => {
    sess.getSession.mockResolvedValue({ email: "a@b.test", name: "A", role: "viewer", companyId: null, branchId: null });
    await expect(LoginPage(sp() as never)).rejects.toMatchObject({ url: "/progress" });
  });

  it("shows only the password form when Microsoft sign-in is off", async () => {
    sess.getSession.mockResolvedValue(null);
    const html = await renderPage(LoginPage as never, sp());
    expect(html).toContain("login-form");
    expect(html).not.toContain("Sign in with Microsoft");
    expect(html).not.toContain("fallback sign-in");
  });

  it("shows the Microsoft button plus the fallback when both are enabled", async () => {
    sess.getSession.mockResolvedValue(null);
    vi.stubEnv("AUTH_ENTRA_ENABLED", "true");
    vi.stubEnv("AUTH_ENTRA_CLIENT_ID", "c");
    vi.stubEnv("AUTH_ENTRA_CLIENT_SECRET", "s");
    vi.stubEnv("AUTH_ENTRA_TENANT_ID", "t");
    const html = await renderPage(LoginPage as never, sp());
    expect(html).toContain('href="/api/auth/entra/login"');
    expect(html).toContain("Sign in with Microsoft");
    expect(html).toContain("login-form");
  });

  it("hides the password form when the fallback is off", async () => {
    sess.getSession.mockResolvedValue(null);
    vi.stubEnv("AUTH_FALLBACK_ENABLED", "false");
    expect(await renderPage(LoginPage as never, sp())).not.toContain("login-form");
  });

  it("shows an error passed in the query string, escaped", async () => {
    sess.getSession.mockResolvedValue(null);
    const html = await renderPage(LoginPage as never, sp("<script>alert(1)</script>"));
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});

describe("home and root layout", () => {
  it("/ redirects to /progress", () => {
    expect(() => Home()).toThrow(expect.objectContaining({ url: "/progress" }));
  });

  it("root layout sets language, font variable and metadata", async () => {
    const html = await renderPage(RootLayout as never, { children: kids });
    expect(html).toContain('lang="en-AU"');
    expect(html).toContain("poppins-var");
    expect(metadata.title).toBe("PRD Operations Dashboard");
  });
});
