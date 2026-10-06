import { expect, test } from "@playwright/test";
import { HAS_DB, SKIP_MESSAGE, emailOf, stateFile } from "./constants";
import { dbRows } from "./helpers";

test.skip(!HAS_DB, SKIP_MESSAGE);

const OPEN = "/buyer?tab=conversations&c=sample-pen-0";

test.describe("buyer conversations (read only)", () => {
  test.use({ storageState: stateFile("agent") });

  test("the list is labelled sample, with a table of conversations and Hot/Warm badges", async ({ page }) => {
    await page.goto("/buyer");
    await expect(page.locator(".ribbon").first()).toBeVisible();
    await expect(page.getByText("Showing sample conversations")).toBeVisible();
    await expect(page.locator("table.t tbody tr").first()).toBeVisible();
    await expect(page.getByText("Sample Buyer 01")).toBeVisible();
  });

  test("every tab renders", async ({ page }) => {
    for (const [tab, text] of [["funnel", "Where enquiries come from"], ["handovers", "Handovers"], ["quality", "Automatic checks"]] as const) {
      await page.goto(`/buyer?tab=${tab}`);
      await expect(page.getByRole("heading", { name: text })).toBeVisible();
    }
  });

  test("opening a conversation shows the thread with contact details masked", async ({ page }) => {
    await page.goto(OPEN);
    const drawer = page.locator(".drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText("Sample Buyer 01");
    await expect(drawer).toContainText("Is this still available?");
    await expect(drawer).not.toContainText("0400 000 000");
    await expect(drawer).not.toContainText("sample@example.test");
    await expect(drawer).toContainText("•••");
    await expect(drawer.getByRole("link", { name: "Reveal" })).toBeVisible();
  });

  test("closing the drawer returns to the list", async ({ page }) => {
    await page.goto(OPEN);
    await page.locator(".drawer").getByRole("link", { name: "Close" }).click();
    await expect(page.locator(".drawer")).toHaveCount(0);
  });
});

test.describe("WRITES DATA: revealing contact details (adds a PII reveal audit row)", () => {
  test.use({ storageState: stateFile("agent") });

  test("Reveal shows phone and email and writes an audit row naming the user", async ({ page }) => {
    const before = (await dbRows("select count(*)::int as n from audit_log where action = 'PII reveal' and actor_email = $1", [emailOf("agent")]))[0].n;
    await page.goto(OPEN);
    await page.locator(".drawer").getByRole("link", { name: "Reveal" }).click();
    await expect(page.locator(".drawer")).toContainText("0400 000 000");
    await expect(page.locator(".drawer")).toContainText("sample@example.test");
    await expect(page.locator(".drawer").getByRole("link", { name: "Reveal" })).toHaveCount(0);
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
