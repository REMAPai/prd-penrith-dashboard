import { expect, test } from "@playwright/test";
import { E2E_USERS, HAS_DB, SKIP_MESSAGE, emailOf, stateFile } from "./constants";
import { dbRows, runInfo, unique } from "./helpers";

test.skip(!HAS_DB, SKIP_MESSAGE);

// Every test in this file WRITES DATA to the throwaway database. They run in order, one worker.
test.describe.configure({ mode: "serial" });

test.describe("WRITES DATA: development pipeline", () => {
  test.use({ storageState: stateFile("branch_admin") });

  // Serial groups rerun from the top on retry but keep database state, so start every attempt from a known site state.
  test.beforeAll(async () => {
    const { address } = runInfo();
    await dbRows("delete from pipeline_events where site_id in (select id from pipeline_sites where address = $1)", [address]);
    await dbRows("update pipeline_sites set stage = 0, zoning = 'TBC', zoning_confirmed = false where address = $1", [address]);
  });

  test("moving a stage updates the card, shows in history and writes an audit row", async ({ page }) => {
    const { address } = runInfo();
    await page.goto("/pipeline?tab=table");
    await page.getByRole("link", { name: address }).click();
    await expect(page.locator(".drawer")).toContainText(address);
    await expect(page.locator(".drawer")).toContainText("Zoning TBC: confirm before acting");
    await page.locator('.drawer select[name="stage"]').selectOption({ label: "Qualified" });
    await page.getByRole("button", { name: "Move", exact: true }).click();
    await expect(page.locator(".drawer").getByText("Detected to Qualified")).toBeVisible();
    await expect(page.locator(".drawer .badge", { hasText: "Qualified" }).first()).toBeVisible();
    const audit = await dbRows("select detail from audit_log where action = 'Stage move' and actor_email = $1 order by id desc limit 1", [emailOf("branch_admin")]);
    expect(audit[0].detail).toContain(`${address}: Detected to Qualified`);
  });

  test("moving to the stage it is already in changes nothing", async ({ page }) => {
    const { address } = runInfo();
    await page.goto("/pipeline?tab=table");
    await page.getByRole("link", { name: address }).click();
    const before = await dbRows("select count(*)::int as n from pipeline_events e join pipeline_sites s on s.id = e.site_id where s.address = $1", [address]);
    await page.getByRole("button", { name: "Move", exact: true }).click();
    await page.waitForLoadState("networkidle");
    const after = await dbRows("select count(*)::int as n from pipeline_events e join pipeline_sites s on s.id = e.site_id where s.address = $1", [address]);
    expect(after[0].n).toBe(before[0].n);
  });

  test("confirming zoning records it, hides the form and adds a history entry", async ({ page }) => {
    const { address } = runInfo();
    await page.goto("/pipeline?tab=table");
    await page.getByRole("link", { name: address }).click();
    await page.getByPlaceholder("e.g. R3 Medium Density").fill("R3 Medium Density");
    await page.getByRole("button", { name: "Confirm zoning" }).click();
    await expect(page.locator(".drawer").getByText("Zoning confirmed as R3 Medium Density")).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm zoning" })).toHaveCount(0);
    await expect(page.locator(".drawer .badge", { hasText: "R3 Medium Density" })).toBeVisible();
    const row = await dbRows("select zoning, zoning_confirmed from pipeline_sites where address = $1", [address]);
    expect(row[0]).toEqual({ zoning: "R3 Medium Density", zoning_confirmed: true });
  });

  test("a stage move is visible on the board under its new column", async ({ page }) => {
    const { address } = runInfo();
    await page.goto("/pipeline?tab=board");
    const qualified = page.locator(".kanban .col", { has: page.getByText("Qualified", { exact: true }) });
    await expect(qualified.getByText(address)).toBeVisible();
  });
});

test.describe("WRITES DATA: tasks", () => {
  test.use({ storageState: stateFile("agent") });

  test("adding a task lists it, and Done / Reopen toggles it", async ({ page }) => {
    const text = unique("E2E task");
    await page.goto("/tasks");
    await page.getByPlaceholder("New task, e.g. Confirm zoning: 18 Sydney St").fill(text);
    await page.getByPlaceholder("Who").fill("E2E");
    await page.getByPlaceholder("Due").fill("Friday");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    const row = page.locator("tr", { hasText: text });
    await expect(row).toBeVisible();
    await expect(row).toContainText("E2E · Friday");
    await row.getByRole("button", { name: "Done" }).click();
    await expect(page.locator("tr", { hasText: text }).getByRole("button", { name: "Reopen" })).toBeVisible();
    await page.locator("tr", { hasText: text }).getByRole("button", { name: "Reopen" }).click();
    await expect(page.locator("tr", { hasText: text }).getByRole("button", { name: "Done" })).toBeVisible();
  });

  test("a one-character task is rejected and not saved", async ({ page }) => {
    await page.goto("/tasks");
    const before = (await dbRows("select count(*)::int as n from tasks"))[0].n;
    await page.getByPlaceholder("New task, e.g. Confirm zoning: 18 Sydney St").fill("x");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.waitForLoadState("networkidle");
    expect((await dbRows("select count(*)::int as n from tasks"))[0].n).toBe(before);
  });

  test("the activity feed shows the stage move made earlier", async ({ page }) => {
    await page.goto("/tasks");
    await expect(page.getByRole("cell", { name: /Stage move/ }).first()).toBeVisible();
  });
});

test.describe("WRITES DATA: feedback", () => {
  test.use({ storageState: stateFile("viewer") });

  test("a viewer submits feedback, sees it listed and can vote for it", async ({ page }) => {
    const body = unique("E2E feedback");
    await page.goto("/feedback");
    await page.locator('select[name="page"]').selectOption("Map");
    await page.locator('select[name="rating"]').selectOption("confusing");
    await page.getByPlaceholder("What would you change?").fill(body);
    await page.getByRole("button", { name: "Send" }).click();
    const row = page.locator("tr", { hasText: body });
    await expect(row).toBeVisible();
    await expect(row).toContainText("Map");
    await expect(row.getByRole("button", { name: /\+1 · 0/ })).toBeVisible();
    await row.getByRole("button", { name: /\+1/ }).click();
    const voted = page.locator("tr", { hasText: body }).getByRole("button", { name: "Voted · 1" });
    await expect(voted).toBeVisible();
    await expect(voted).toBeDisabled(); // one vote per user
    await expect(page.locator("tr", { hasText: body }).getByText("New", { exact: true })).toBeVisible();
  });

  test("a viewer sees the status as a badge, not a triage dropdown", async ({ page }) => {
    await page.goto("/feedback");
    await expect(page.getByRole("button", { name: "Save" })).toHaveCount(0);
  });
});

test.describe("WRITES DATA: feedback triage by a platform admin", () => {
  test.use({ storageState: stateFile("platform_admin") });

  test("setting a feedback item to Done moves it into 'You said, we did' and is audited", async ({ page }) => {
    const body = unique("E2E triage");
    await page.goto("/feedback");
    await page.getByPlaceholder("What would you change?").fill(body);
    await page.getByRole("button", { name: "Send" }).click();
    const row = page.locator("tr", { hasText: body });
    await row.locator('select[name="status"]').selectOption("Done");
    await row.getByRole("button", { name: "Save" }).click();
    await expect(page.locator("li", { hasText: body })).toBeVisible();
    const audit = await dbRows("select 1 from audit_log where action = 'Feedback status' and detail like '%Done'");
    expect(audit.length).toBeGreaterThan(0);
  });
});

test.describe("WRITES DATA: users and roles", () => {
  test.use({ storageState: stateFile("branch_admin") });

  test("a branch admin only sees users of their own branch and cannot grant higher roles", async ({ page }) => {
    await page.goto("/users");
    await expect(page.getByRole("cell", { name: emailOf("viewer"), exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: emailOf("bm_viewer"), exact: true })).toHaveCount(0);
    await expect(page.getByRole("cell", { name: emailOf("platform_admin"), exact: true })).toHaveCount(0);
    const options = await page.locator('select[name="role"] option').allInnerTexts();
    expect(options).toEqual(["Marketing", "Sales agent", "Viewer"]);
    await expect(page.locator('select[name="branch"] option')).toHaveCount(1);
  });

  test("adds a user, then deactivates and reactivates them; own row has no deactivate button", async ({ page }) => {
    const email = `e2e-added-${Date.now().toString(36)}@prd.test`;
    await page.goto("/users");
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[name="name"]').fill("E2E Added User");
    await page.locator('select[name="role"]').selectOption({ label: "Sales agent" });
    await page.getByRole("button", { name: "Add", exact: true }).click();
    const row = page.locator("tr", { hasText: email });
    await expect(row).toContainText("Sales agent");
    await expect(row).toContainText("active");
    await row.getByRole("button", { name: "Deactivate" }).click();
    await expect(page.locator("tr", { hasText: email })).toContainText("deactivated");
    await page.locator("tr", { hasText: email }).getByRole("button", { name: "Reactivate" }).click();
    await expect(page.locator("tr", { hasText: email })).toContainText("active");
    await expect(page.locator("tr", { hasText: emailOf("branch_admin") }).getByRole("button")).toHaveCount(0);
    await expect(page.locator("tr", { hasText: emailOf("branch_admin") })).toBeVisible();
    const audit = await dbRows("select action from audit_log where detail like $1 order by id", [`%${email}%`]);
    expect(audit.map((a) => a.action)).toEqual(["User added", "User status", "User status"]);
  });

  test("a deactivated user can no longer sign in", async ({ browser }) => {
    const email = emailOf("marketing");
    await dbRows("update users set status = 'deactivated' where email = $1", [email]);
    try {
      const ctx = await browser.newContext({ storageState: stateFile("marketing") });
      const page = await ctx.newPage();
      await page.goto("/progress");
      await expect(page).toHaveURL(/\/login$/);
      await ctx.close();
    } finally {
      await dbRows("update users set status = 'active' where email = $1", [email]);
    }
  });
});

test.describe("WRITES DATA: platform admin user management", () => {
  test.use({ storageState: stateFile("platform_admin") });

  test("a platform admin sees all users and can grant platform admin; branch admins stay out of other branches", async ({ page }) => {
    await page.goto("/users");
    for (const u of E2E_USERS) await expect(page.getByRole("cell", { name: u.email, exact: true })).toBeVisible();
    expect(await page.locator('select[name="role"] option').allInnerTexts()).toContain("Platform admin");
    await expect(page.getByRole("button", { name: "Deactivate" }).first()).toBeVisible();
    await expect(page.locator("tr", { hasText: emailOf("platform_admin") }).getByRole("button")).toHaveCount(0);
  });
});
