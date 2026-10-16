import { expect, test } from "@playwright/test";
import { HAS_DB, SKIP_MESSAGE, stateFile } from "./constants";

test.skip(!HAS_DB, SKIP_MESSAGE);

const links = async (page: import("@playwright/test").Page) => (await page.locator("aside a.item").allInnerTexts()).map((t) => t.trim());

test.describe("role-based sidebar and access (read only)", () => {
  test.describe("viewer", () => {
    test.use({ storageState: stateFile("viewer") });

    test("sees only the pages open to everyone", async ({ page }) => {
      await page.goto("/progress");
      expect(await links(page)).toEqual(["Delivery Progress", "Executive Overview", "Feedback"]);
      await expect(page.getByText("Viewer", { exact: true })).toBeVisible();
    });

    for (const path of ["/buyer", "/pipeline", "/users", "/audit", "/sources", "/companies", "/finance"]) {
      test(`${path} says No access`, async ({ page }) => {
        await page.goto(path);
        await expect(page.getByText("No access")).toBeVisible();
        await expect(page.getByText("Your role does not include this page.")).toBeVisible();
      });
    }

    test("cannot tick off delivery asks", async ({ page }) => {
      await page.goto("/progress");
      await expect(page.getByRole("button", { name: "Mark done" })).toHaveCount(0);
    });
  });

  test.describe("agent", () => {
    test.use({ storageState: stateFile("agent") });

    test("sees operational pages but no admin, finance or map pages", async ({ page }) => {
      await page.goto("/progress");
      const l = await links(page);
      expect(l).toEqual(expect.arrayContaining(["Buyer Sequencing", "Listings and Demand", "Development Playbook", "Activity and Tasks", "Feedback"]));
      for (const hidden of ["Users and Roles", "Audit Log", "Data Sources", "Finance", "Map", "Companies and Branches"]) expect(l).not.toContain(hidden);
    });

    test("can open the pipeline but gets no move or zoning controls", async ({ page }) => {
      await page.goto("/pipeline?tab=table");
      await page.locator("table.t a").first().click();
      await expect(page.locator(".drawer")).toBeVisible();
      await expect(page.getByText("Move to stage")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Confirm zoning" })).toHaveCount(0);
    });
  });

  test.describe("branch admin", () => {
    test.use({ storageState: stateFile("branch_admin") });

    test("sees admin pages but not the platform group", async ({ page }) => {
      await page.goto("/progress");
      const l = await links(page);
      expect(l).toEqual(expect.arrayContaining(["Users and Roles", "Audit Log", "Data Sources", "Finance"]));
      expect(l).not.toContain("Companies and Branches");
      await expect(page.locator("aside .grp", { hasText: "Platform" })).toHaveCount(0);
    });

    test("/companies says No access", async ({ page }) => {
      await page.goto("/companies");
      await expect(page.getByText("No access")).toBeVisible();
    });
  });

  test.describe("marketing", () => {
    test.use({ storageState: stateFile("marketing") });

    test("sees the map and projects but not finance or users", async ({ page }) => {
      await page.goto("/progress");
      const l = await links(page);
      expect(l).toEqual(expect.arrayContaining(["Map", "Projects and Stock", "Meta Lead Funnel"]));
      expect(l).not.toContain("Finance");
      expect(l).not.toContain("Users and Roles");
    });
  });

  test.describe("platform admin", () => {
    test.use({ storageState: stateFile("platform_admin") });

    test("sees every page including Companies and Branches", async ({ page }) => {
      await page.goto("/companies");
      expect((await links(page)).length).toBe(19);
      await expect(page.getByRole("heading", { level: 1, name: "Companies and Branches" })).toBeVisible();
      await expect(page.getByText("Microsoft tenants")).toBeVisible();
    });

    test("can switch between branches from the top bar", async ({ page }) => {
      await page.goto("/progress");
      const select = page.locator("header select");
      await expect(select).toBeVisible();
      await select.selectOption({ label: "Blue Mountains" });
      await expect(page.locator("aside").getByText("Blue Mountains")).toBeVisible();
    });
  });
});
