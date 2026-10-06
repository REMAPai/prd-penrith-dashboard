import { expect, test } from "@playwright/test";
import { HAS_DB, SKIP_MESSAGE, stateFile } from "./constants";

test.skip(!HAS_DB, SKIP_MESSAGE);

// The toggle only sets a browser cookie, so these tests do not write to the database.
test.describe("Live only toggle (read only)", () => {
  test.use({ storageState: stateFile("platform_admin") });

  test("Finance is all sample data: ribbons show by default and disappear in Live only", async ({ page }) => {
    await page.goto("/finance");
    await expect(page.locator(".ribbon").first()).toBeVisible();
    await page.getByRole("button", { name: "Live only" }).click();
    await expect(page.getByRole("button", { name: "Live only" })).toHaveClass(/on/);
    await expect(page.locator(".ribbon")).toHaveCount(0);
    await expect(page.getByText("Sample data: not PRD figures")).toHaveCount(0);
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

  test("the pipeline hides invented sample sites in Live only and shows them again in All", async ({ page }) => {
    await page.goto("/pipeline?tab=table");
    await expect(page.getByText("Sample", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Rows marked Sample are invented")).toBeVisible();
    await page.getByRole("button", { name: "Live only" }).click();
    await expect(page.getByText("Rows marked Sample are invented")).toHaveCount(0);
    await expect(page.locator("td", { hasText: "Sample" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "84 Cox Avenue" })).toBeVisible();
    await page.getByRole("button", { name: "All" }).click();
    await expect(page.getByText("Sample", { exact: true }).first()).toBeVisible();
  });

  test("Buyer Sequencing is sample until the live log is connected, so Live only leaves no sample ribbon", async ({ page }) => {
    await page.goto("/buyer");
    await expect(page.locator(".ribbon").first()).toBeVisible();
    await page.getByRole("button", { name: "Live only" }).click();
    await expect(page.locator(".ribbon")).toHaveCount(0);
  });
});
