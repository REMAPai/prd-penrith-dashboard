import { expect, test } from "@playwright/test";
import { HAS_DB, SKIP_MESSAGE, stateFile } from "./constants";
import { mapTilesOffline, watchErrors } from "./helpers";

test.skip(!HAS_DB, SKIP_MESSAGE);

const PAGES: [string, string][] = [
  ["/progress", "Delivery Progress"],
  ["/exec", "Executive Overview"],
  ["/buyer", "Buyer Sequencing"],
  ["/listings", "Listings and Demand"],
  ["/pipeline", "Development Playbook"],
  ["/map", "Map"],
  ["/projects", "Projects and Stock"],
  ["/meta", "Meta Lead Funnel"],
  ["/pm", "Property Management"],
  ["/comm", "Commercial"],
  ["/market", "Market Insights"],
  ["/finance", "Finance"],
  ["/tasks", "Activity and Tasks"],
  ["/alerts", "Alerts and Logs"],
  ["/feedback", "Feedback"],
  ["/sources", "Data Sources"],
  ["/users", "Users and Roles"],
  ["/audit", "Audit Log"],
  ["/companies", "Companies and Branches"],
];

test.describe("every page renders for a platform admin (read only)", () => {
  test.use({ storageState: stateFile("platform_admin") });

  for (const [path, title] of PAGES) {
    test(`${path} shows "${title}" without console errors`, async ({ page }) => {
      const errors = watchErrors(page);
      await mapTilesOffline(page);
      const res = await page.goto(path);
      expect(res?.status()).toBeLessThan(400);
      await expect(page.getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible();
      await expect(page.getByText("No access")).toHaveCount(0);
      await page.waitForLoadState("networkidle");
      expect(errors).toEqual([]);
    });
  }

  test("the home page redirects to Delivery Progress", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/progress$/);
  });

  test("every sidebar link works and the page title matches", async ({ page }) => {
    await page.goto("/progress");
    const links = page.locator("aside a.item");
    const n = await links.count();
    expect(n).toBe(PAGES.length);
    for (let i = 0; i < n; i++) {
      const href = await links.nth(i).getAttribute("href");
      const expected = PAGES.find(([p]) => p === href)![1];
      await links.nth(i).click();
      await expect(page.getByRole("heading", { level: 1, name: expected, exact: true })).toBeVisible();
    }
  });
});

test.describe("map (read only)", () => {
  test.use({ storageState: stateFile("branch_admin") });

  test("loads the map canvas, layer buttons and stage legend without console errors", async ({ page }) => {
    const errors = watchErrors(page);
    await mapTilesOffline(page);
    await page.goto("/map");
    await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Sites" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Buyer demand" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Listings" })).toBeVisible();
    await expect(page.getByText("Negotiation", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Sites" }).click();
    await expect(page.getByRole("button", { name: "Sites" })).not.toHaveClass(/on/);
    expect(errors.filter((e) => !/WebGL|swiftshader/i.test(e))).toEqual([]);
  });
});

test.describe("mobile width (read only)", () => {
  test.use({ storageState: stateFile("branch_admin"), viewport: { width: 375, height: 812 } });

  for (const path of ["/progress", "/buyer", "/pipeline"]) {
    test(`${path} renders at phone width and its content stays reachable`, async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
});
