import { expect, test } from "@playwright/test";
import { E2E_PASSWORD, ENTRA_URL, HAS_DB, INGEST_KEY, SKIP_MESSAGE, emailOf } from "./constants";
import { dbRows, unique } from "./helpers";

test.skip(!HAS_DB, SKIP_MESSAGE);

test.describe("login page (read only)", () => {
  test("renders the password form and no Microsoft button when Entra is off", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Sign in", { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder("Email")).toBeVisible();
    await expect(page.getByPlaceholder("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
    await expect(page.getByText("Sign in with Microsoft")).toHaveCount(0);
  });

  test("shows the Microsoft button (and the fallback) when Entra is enabled", async ({ page }) => {
    test.skip(process.env.E2E_DEV === "1", "The Entra-enabled server only runs against a production build.");
    await page.goto(`${ENTRA_URL}/login`);
    await expect(page.getByRole("link", { name: "Sign in with Microsoft" })).toHaveAttribute("href", "/api/auth/entra/login");
    await expect(page.getByPlaceholder("Email")).toBeVisible();
  });

  test("the Microsoft login route redirects to Microsoft with PKCE (redirect is not followed)", async ({ request }) => {
    test.skip(process.env.E2E_DEV === "1", "The Entra-enabled server only runs against a production build.");
    const res = await request.get(`${ENTRA_URL}/api/auth/entra/login`, { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    const to = new URL(res.headers()["location"]);
    expect(to.origin).toBe("https://login.microsoftonline.com");
    expect(to.searchParams.get("code_challenge_method")).toBe("S256");
    expect(res.headers()["set-cookie"]).toContain("prd_oidc=");
  });

  test("the Microsoft callback rejects a missing state cookie without signing anyone in", async ({ request }) => {
    const res = await request.get("/api/auth/entra/callback?code=abc&state=forged", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers()["location"]).toContain("/login?error=");
    expect(res.headers()["set-cookie"] ?? "").not.toContain("prd_session");
  });

  test("on a mobile-width screen the sign-in form fits without sideways scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test.describe("unauthenticated access (read only)", () => {
  for (const path of ["/", "/progress", "/buyer", "/pipeline", "/users", "/audit", "/companies", "/map", "/buyer?tab=conversations&c=e2e-pen-0&reveal=e2e-pen-0"]) {
    test(`${path} redirects to /login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByPlaceholder("Email")).toBeVisible();
    });
  }

  test("a forged session cookie is rejected by the server (not just by the proxy)", async ({ context, page }) => {
    await context.addCookies([{ name: "prd_session", value: "not-a-real-token", url: "http://localhost:3100" }]);
    await page.goto("/progress");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("the ingest API refuses requests without the key and never serves GET", async ({ request }) => {
    expect((await request.post("/api/ingest/claim", { data: { conversationId: "x", message: "y" } })).status()).toBe(401);
    expect((await request.post("/api/ingest/claim", { headers: { "x-ingest-key": "wrong" }, data: { conversationId: "x" } })).status()).toBe(401);
    expect((await request.get("/api/ingest/claim")).status()).toBe(405);
  });
});

test.describe("WRITES DATA: sign-in flows (adds audit rows and updates last_login)", () => {
  test("a wrong password shows an error and writes a failed sign-in audit row", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Email").fill(emailOf("viewer"));
    await page.getByPlaceholder("Password").fill("definitely-wrong");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Wrong email or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    const rows = await dbRows("select 1 from audit_log where actor_email = $1 and action = 'Sign-in failed'", [emailOf("viewer")]);
    expect(rows.length).toBeGreaterThan(0);
  });

  test("an unknown email gets the same error as a wrong password", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Email").fill("nobody@prd.test");
    await page.getByPlaceholder("Password").fill("whatever");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Wrong email or password.")).toBeVisible();
  });

  test("a viewer signs in with the right password, lands on Delivery Progress, then signs out", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Email").fill(emailOf("viewer"));
    await page.getByPlaceholder("Password").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/progress$/);
    await expect(page.getByRole("heading", { name: "Delivery Progress" })).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/progress");
    await expect(page).toHaveURL(/\/login$/);
    const rows = await dbRows("select action from audit_log where actor_email = $1 and action in ('Sign-in','Sign-out')", [emailOf("viewer")]);
    expect(rows.map((r) => r.action)).toEqual(expect.arrayContaining(["Sign-in", "Sign-out"]));
  });

  test("a platform admin signing in lands on Companies and Branches", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Email").fill(emailOf("platform_admin"));
    await page.getByPlaceholder("Password").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/companies$/);
  });
});

test.describe("WRITES DATA: ingest API idempotency (adds a buyer_claims row)", () => {
  test("a duplicate claim for the same message is refused", async ({ request }) => {
    const conversationId = unique("e2e-conv");
    const send = () => request.post("/api/ingest/claim", { headers: { "x-ingest-key": INGEST_KEY }, data: { conversationId, message: "Is it still available?" } });
    expect(await (await send()).json()).toEqual({ claimed: true });
    expect(await (await send()).json()).toEqual({ claimed: false });
  });
});
