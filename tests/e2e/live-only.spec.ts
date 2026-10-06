import { expect, test } from "@playwright/test";
import { HAS_DB, SKIP_MESSAGE, stateFile } from "./constants";

test.skip(!HAS_DB, SKIP_MESSAGE);

// The toggle only sets a browser cookie, so these tests do not write to the database.
test.describe("Live only toggle (read only)", () => {
  test.use({ storageState: stateFile("platform_admin") });

  test("Finance has no figures and no sample ribbon, with or without Live only", async ({ page }) => {
    await page.goto("/finance");
    await expect(page.locator(".ribbon")).toHaveCount(0);
    await expect(page.getByText("No financial data has been shared with us yet")).toBeVisible();
    await page.getByRole("button", { name: "Live only" }).click();
    await expect(page.getByRole("button", { name: "Live only" })).toHaveClass(/on/);
    await expect(page.locator(".ribbon")).toHaveCount(0);
    await expect(page.locator(".card")).toHaveCount(0);
  });

  test("the choice persists across pages and can be switched back", async ({ page }) => {
    await page.goto("/exec");
    await page.getByRole("button", { name: "Live only" }).click();
    await expect(page.getByRole("button", { name: "Live only" })).toHaveClass(/on/);
    await page.goto("/pipeline");
    await expect(page.getByRole("button", { name: "Live only" })).toHaveClass(/on/);
    await expect(page.locator(".ribbon")).toHaveCount(0);
    await page.getByRole("button", { name: "All" }).click();
    await expect(page.getByRole("button", { name: "All" })).toHaveClass(/on/);
  });

  test("the pipeline labels invented rows as Data under testing and hides them in Live only", async ({ page }) => {
    await page.goto("/pipeline?tab=table");
    await expect(page.getByRole("link", { name: "84 Cox Avenue" })).toBeVisible();
    const testing = page.locator("tr", { hasText: "E2E Under Testing Row" });
    await expect(testing).toContainText("Data under testing");
    await page.getByRole("button", { name: "Live only" }).click();
    await expect(page.getByRole("link", { name: "84 Cox Avenue" })).toBeVisible();
    await expect(page.locator("tr", { hasText: "E2E Under Testing Row" })).toHaveCount(0);
    await page.getByRole("button", { name: "All" }).click();
    await expect(page.getByRole("link", { name: "84 Cox Avenue" })).toBeVisible();
  });

  test("Buyer Sequencing reads the live database, so it stays visible in Live only", async ({ page }) => {
    await page.goto("/buyer");
    await expect(page.locator(".ribbon")).toHaveCount(0);
    await page.getByRole("button", { name: "Live only" }).click();
    await expect(page.locator(".ribbon")).toHaveCount(0);
    await expect(page.getByText("E2E Buyer")).toBeVisible();
  });
});
