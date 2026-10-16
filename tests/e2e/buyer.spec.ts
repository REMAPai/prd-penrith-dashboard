import { expect, test } from "@playwright/test";
import { HAS_DB, SKIP_MESSAGE, emailOf, stateFile } from "./constants";
import { dbRows } from "./helpers";

test.skip(!HAS_DB, SKIP_MESSAGE);

const OPEN = "/buyer/e2e-pen-0?day=all";

test.describe("buyer conversations (read only)", () => {
  test.use({ storageState: stateFile("agent") });

  test("the page opens on the latest day, with one tab per day and All Data last, and no sample ribbon", async ({ page }) => {
    await page.goto("/buyer");
    await expect(page.locator(".ribbon")).toHaveCount(0);
    const tabs = page.locator(".bz-tabs a");
    await expect(tabs.first()).toContainText("(latest)");
    await expect(tabs.last()).toHaveText("All Data");
    await expect(tabs.first()).toHaveClass(/on/);
    await expect(page.locator("table.t tbody tr").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "E2E Buyer" })).toBeVisible();
  });

  test("All Data lists every buyer", async ({ page }) => {
    await page.goto("/buyer?day=all");
    await expect(page.locator(".bz-tabs a.on")).toHaveText("All Data");
    await expect(page.getByRole("link", { name: "E2E Buyer" })).toBeVisible();
  });

  test("opening a buyer shows the buyer page with the chat and contact details masked", async ({ page }) => {
    await page.goto("/buyer");
    await page.getByRole("link", { name: "E2E Buyer" }).click();
    await expect(page).toHaveURL(/\/buyer\/e2e-pen-0/);
    await expect(page.getByRole("heading", { name: /E2E Buyer/ })).toBeVisible();
    await expect(page.getByText("Is this still available?")).toBeVisible();
    await expect(page.getByText("Yes, it is. Open home this Saturday.")).toBeVisible();
    await expect(page.getByText("Handled by")).toBeVisible();
    await expect(page.getByText("Property record in Vault")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("0400 000 000");
    await expect(page.locator("body")).not.toContainText("e2e-buyer@example.test");
    await expect(page.getByRole("link", { name: /^Show phone and email/ })).toBeVisible();
  });

  test("Back returns to the tab the buyer was opened from", async ({ page }) => {
    await page.goto(OPEN);
    await page.getByRole("link", { name: /^Back to/ }).click();
    await expect(page).toHaveURL(/\/buyer\?day=all/);
  });
});

test.describe("WRITES DATA: revealing contact details (adds a PII reveal audit row)", () => {
  test.use({ storageState: stateFile("agent") });

  test("Reveal shows phone and email and writes an audit row naming the user", async ({ page }) => {
    const before = (await dbRows("select count(*)::int as n from audit_log where action = 'PII reveal' and actor_email = $1", [emailOf("agent")]))[0].n;
    await page.goto(OPEN);
    await page.getByRole("link", { name: /^Show phone and email/ }).click();
    await expect(page.locator("body")).toContainText("0400 000 000");
    await expect(page.locator("body")).toContainText("e2e-buyer@example.test");
    await expect(page.getByRole("link", { name: /^Hide phone and email/ })).toBeVisible();
    const after = (await dbRows("select count(*)::int as n from audit_log where action = 'PII reveal' and actor_email = $1", [emailOf("agent")]))[0].n;
    expect(after).toBeGreaterThan(before);
  });

  test("the reveal appears in the audit log for an admin", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: stateFile("branch_admin") });
    const page = await ctx.newPage();
    await page.goto("/audit");
    await expect(page.getByRole("cell", { name: "PII reveal" }).first()).toBeVisible();
    await ctx.close();
  });
});
