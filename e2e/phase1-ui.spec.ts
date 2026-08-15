import { test, expect, type APIRequestContext } from "@playwright/test";
import { RUN_TAG, adminApi, createLead, deleteLeads, uiLogin, waitForTable } from "./helpers";

/**
 * Change Request Phase 1 — browser behaviour in Chromium.
 *
 * Point 1  — email column + "Quote" button on the lead row
 * Point 3  — quotation/PI line-item numbers are fully readable
 * Point 7  — the new status list appears in the filter and the edit form
 * Point 8  — leads show a date AND time
 * Point 9  — location/quantity columns and filters; admin bulk delete
 */

let ctx: APIRequestContext;
const created: string[] = [];

test.beforeAll(async () => {
  ({ ctx } = await adminApi());
});

test.afterAll(async () => {
  await deleteLeads(ctx, created);
  await ctx.dispose();
});

test.beforeEach(async ({ page }) => {
  await uiLogin(page);
});

test.describe("Leads list", () => {
  test("point 1 + 8 + 9: Email, Qty, Location and Received columns are shown", async ({ page }) => {
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} columns`, quantity: 4 });
    created.push(lead.id);

    await page.goto("/leads");
    await waitForTable(page);

    const headers = page.locator("table thead th");
    await expect(headers.filter({ hasText: /^Email$/ })).toHaveCount(1);
    await expect(headers.filter({ hasText: /^Location$/ })).toHaveCount(1);
    await expect(headers.filter({ hasText: /^Qty$/ })).toHaveCount(1);
    await expect(headers.filter({ hasText: /^Received$/ })).toHaveCount(1);

    // Find our lead and check its cells carry real values.
    await page.getByPlaceholder("Customer, mobile, city, requirement...").fill(RUN_TAG);
    await waitForTable(page);
    const row = page.locator("tbody tr", { hasText: `${RUN_TAG} columns` }).first();
    await expect(row).toBeVisible();
    await expect(row.getByRole("link", { name: /@e2e\.test$/ })).toBeVisible();
    await expect(row).toContainText(`${RUN_TAG}TOWN`);
  });

  test("point 8: Received shows a time of day, not just a date", async ({ page }) => {
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} clock` });
    created.push(lead.id);

    await page.goto("/leads");
    await page.getByPlaceholder("Customer, mobile, city, requirement...").fill(RUN_TAG);
    await waitForTable(page);

    const row = page.locator("tbody tr", { hasText: `${RUN_TAG} clock` }).first();
    // formatDateTime → "08 Aug 2026, 05:12 pm"
    await expect(row).toContainText(/\d{2}\s\w{3}\s\d{4},\s*\d{1,2}:\d{2}/);
  });

  test("point 7: the status filter offers the new vocabulary and not In Progress", async ({
    page,
  }) => {
    await page.goto("/leads");
    await waitForTable(page);

    const filter = page.locator("#lead-status-filter");
    const options = await filter.locator("option").allInnerTexts();

    for (const label of [
      "New",
      "Important",
      "Contacted",
      "Follow-up",
      "Quotation Sent",
      "Negotiation",
      "Deal Done",
      "Converted",
      "Not Interested",
      "Irrelevant",
      "Other",
    ]) {
      expect(options, `missing status "${label}"`).toContain(label);
    }
    expect(options).not.toContain("In Progress");
  });

  test("point 7: a new status can be saved from the edit dialog", async ({ page }) => {
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} statusedit` });
    created.push(lead.id);

    await page.goto("/leads");
    await page.getByPlaceholder("Customer, mobile, city, requirement...").fill(RUN_TAG);
    await waitForTable(page);

    const row = page.locator("tbody tr", { hasText: `${RUN_TAG} statusedit` }).first();
    await row.getByRole("button", { name: "Edit" }).click();

    const dialog = page.locator("div.fixed.inset-0").filter({ hasText: "Edit Lead" });
    await expect(dialog).toBeVisible();
    await dialog
      .locator("select")
      .filter({ hasText: "Quotation Sent" })
      .selectOption("negotiation");
    await dialog.getByRole("button", { name: "Save Changes" }).click();

    await expect(dialog).toBeHidden();
    await expect(
      page.locator("tbody tr", { hasText: `${RUN_TAG} statusedit` }).first(),
    ).toContainText("Negotiation");
  });

  test("point 9: the quantity filter narrows the list", async ({ page }) => {
    const small = await createLead(ctx, { customerName: `${RUN_TAG} qtysmall`, quantity: 1 });
    const large = await createLead(ctx, { customerName: `${RUN_TAG} qtylarge`, quantity: 42 });
    created.push(small.id, large.id);

    await page.goto("/leads");
    await page.getByPlaceholder("Customer, mobile, city, requirement...").fill(RUN_TAG);
    await waitForTable(page);
    await expect(page.locator("tbody tr", { hasText: `${RUN_TAG} qtysmall` })).toHaveCount(1);

    await page.getByLabel("Minimum quantity").fill("40");
    await waitForTable(page);

    await expect(page.locator("tbody tr", { hasText: `${RUN_TAG} qtylarge` })).toHaveCount(1);
    await expect(page.locator("tbody tr", { hasText: `${RUN_TAG} qtysmall` })).toHaveCount(0);
  });

  test("point 9: the location filter narrows the list", async ({ page }) => {
    const here = await createLead(ctx, {
      customerName: `${RUN_TAG} locmatch`,
      city: `${RUN_TAG}PLACE`,
    });
    const elsewhere = await createLead(ctx, {
      customerName: `${RUN_TAG} locother`,
      city: "Faraway",
    });
    created.push(here.id, elsewhere.id);

    await page.goto("/leads");
    await page.getByPlaceholder("Customer, mobile, city, requirement...").fill(RUN_TAG);
    await waitForTable(page);
    await expect(page.locator("tbody tr", { hasText: `${RUN_TAG} locother` })).toHaveCount(1);

    await page.locator("#lead-location-filter").fill(`${RUN_TAG}PLACE`);
    await waitForTable(page);

    await expect(page.locator("tbody tr", { hasText: `${RUN_TAG} locmatch` })).toHaveCount(1);
    await expect(page.locator("tbody tr", { hasText: `${RUN_TAG} locother` })).toHaveCount(0);
  });
});

test.describe("Point 9 — admin bulk delete in the browser", () => {
  test("only dead leads offer a checkbox, and deleting clears them", async ({ page }) => {
    const dead = await createLead(ctx, {
      customerName: `${RUN_TAG} uidead`,
      status: "not_interested",
    });
    const alive = await createLead(ctx, {
      customerName: `${RUN_TAG} uialive`,
      status: "contacted",
    });
    created.push(dead.id, alive.id);

    await page.goto("/leads");
    await page.getByPlaceholder("Customer, mobile, city, requirement...").fill(RUN_TAG);
    await waitForTable(page);

    // The live lead has no checkbox; the dead one does.
    await expect(page.getByTestId(`select-row-${alive.id}`)).toHaveCount(0);
    const deadBox = page.getByTestId(`select-row-${dead.id}`);
    await expect(deadBox).toBeVisible();

    await deadBox.check();
    const bar = page.getByTestId("bulk-action-bar");
    await expect(bar).toBeVisible();
    await expect(bar).toContainText("1 selected");

    await bar.getByRole("button", { name: "Delete selected" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();

    await expect(page.locator("tbody tr", { hasText: `${RUN_TAG} uidead` })).toHaveCount(0);
    await expect(page.locator("tbody tr", { hasText: `${RUN_TAG} uialive` })).toHaveCount(1);
  });

  test("the selection survives typing and is not wiped on re-render", async ({ page }) => {
    const dead = await createLead(ctx, {
      customerName: `${RUN_TAG} sticky`,
      status: "irrelevant",
    });
    created.push(dead.id);

    await page.goto("/leads");
    await page.getByPlaceholder("Customer, mobile, city, requirement...").fill(RUN_TAG);
    await waitForTable(page);

    await page.getByTestId(`select-row-${dead.id}`).check();
    await expect(page.getByTestId("bulk-action-bar")).toBeVisible();

    // A pure re-render (hovering, focus) must not clear the selection.
    await page.locator("tbody tr").first().hover();
    await page.waitForTimeout(500);
    await expect(page.getByTestId("bulk-action-bar")).toBeVisible();
    await expect(page.getByTestId(`select-row-${dead.id}`)).toBeChecked();
  });
});

test.describe("Point 1 — raise a quotation from a lead row", () => {
  test("the Quote button opens a pre-filled quotation dialog", async ({ page }) => {
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} quoteme`, quantity: 2 });
    created.push(lead.id);

    await page.goto("/leads");
    await page.getByPlaceholder("Customer, mobile, city, requirement...").fill(RUN_TAG);
    await waitForTable(page);

    const row = page.locator("tbody tr", { hasText: `${RUN_TAG} quoteme` }).first();
    await row.getByRole("button", { name: "Quote" }).click();

    const dialog = page.locator("div.fixed.inset-0").filter({ hasText: "New Document" });
    await expect(dialog).toBeVisible();

    // Customer block carries the lead's details...
    await expect(dialog.getByPlaceholder("Customer name *")).toHaveValue(`${RUN_TAG} quoteme`);
    await expect(dialog.getByPlaceholder("Mobile")).toHaveValue("9876500001");
    await expect(dialog.getByPlaceholder("Email")).toHaveValue(`${RUN_TAG.toLowerCase()}@e2e.test`);
    // ...and the first line item is seeded from the requirement.
    await expect(dialog.getByPlaceholder("Description *")).toHaveValue(
      "62.5 kVA silent diesel genset for cold storage",
    );
    await expect(dialog.getByPlaceholder("Qty")).toHaveValue("2");
    await expect(dialog.getByPlaceholder("Rate")).toHaveValue("450000");

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
  });
});

test.describe("Point 3 — line-item numbers are fully readable", () => {
  test("a 6-digit rate is not clipped in the quotation dialog", async ({ page }) => {
    await page.goto("/quotations");
    await waitForTable(page);
    await page.getByRole("button", { name: /New Quotation/ }).click();

    const dialog = page.locator("div.fixed.inset-0").filter({ hasText: "New Document" });
    await expect(dialog).toBeVisible();

    const rate = dialog.getByPlaceholder("Rate");
    await rate.fill("450000");

    // The rendered text must fit inside the box — scrollWidth <= clientWidth
    // means nothing is hidden. This is the exact failure the client reported.
    const fits = await rate.evaluate((el: HTMLInputElement) => el.scrollWidth <= el.clientWidth);
    expect(fits, "rate input is still clipping its value").toBe(true);

    // Same for the other numeric columns.
    for (const [placeholder, value] of [
      ["Qty", "100"],
      ["Disc%", "12.5"],
      ["GST%", "18"],
      ["KVA", "62.5"],
    ] as const) {
      const input = dialog.getByPlaceholder(placeholder);
      await input.fill(value);
      const ok = await input.evaluate((el: HTMLInputElement) => el.scrollWidth <= el.clientWidth);
      expect(ok, `${placeholder} input is clipping "${value}"`).toBe(true);
    }

    // The native spinner is suppressed, so it can't overlay the digits or take
    // the width back. Read `appearance` off the element itself — computed style
    // for a ::-webkit-* pseudo-element is not reliably reported.
    await expect(rate).toHaveClass(/no-spinner/);
    const appearance = await rate.evaluate((el) => window.getComputedStyle(el).appearance);
    expect(appearance).toBe("textfield");

    // And the digits are right-aligned, so the magnitude stays visible even if
    // a value ever does outgrow the box.
    const align = await rate.evaluate((el) => window.getComputedStyle(el).textAlign);
    expect(align).toBe("right");

    await dialog.getByRole("button", { name: "Cancel" }).click();
  });

  test("the live totals preview recomputes as line items are typed", async ({ page }) => {
    // Regression guard: react-hook-form hands back the same array reference for
    // a field array on every render, so a useMemo keyed on that reference
    // cached zeros forever and the preview was stuck at ₹0.00.
    await page.goto("/quotations");
    await waitForTable(page);
    await page.getByRole("button", { name: /New Quotation/ }).click();

    const dialog = page.locator("div.fixed.inset-0").filter({ hasText: "New Document" });
    await expect(dialog).toBeVisible();

    await dialog.getByPlaceholder("Qty").fill("2");
    await dialog.getByPlaceholder("Rate").fill("450000");
    await dialog.getByPlaceholder("GST%").fill("18");

    const totals = dialog
      .locator("div")
      .filter({ hasText: /^Taxable:/ })
      .last();
    // 2 × 450000 = 900000 taxable; 18% = 162000; grand total 1062000.
    await expect(totals).toContainText("9,00,000.00");
    await expect(totals).toContainText("1,62,000.00");
    await expect(totals).toContainText("10,62,000.00");

    // A discount must feed through too.
    await dialog.getByPlaceholder("Disc%").fill("10");
    await expect(totals).toContainText("8,10,000.00");

    await dialog.getByRole("button", { name: "Cancel" }).click();
  });

  test("every line-item column has a visible header", async ({ page }) => {
    await page.goto("/quotations");
    await waitForTable(page);
    await page.getByRole("button", { name: /New Quotation/ }).click();

    const dialog = page.locator("div.fixed.inset-0").filter({ hasText: "New Document" });
    for (const label of [
      "Description",
      "Model",
      "KVA",
      "HSN",
      "Qty",
      "Rate (₹)",
      "Disc %",
      "GST %",
    ]) {
      await expect(dialog.getByText(label, { exact: true })).toBeVisible();
    }
    await dialog.getByRole("button", { name: "Cancel" }).click();
  });
});

test.describe("Point 9 — Inventory and Sales", () => {
  test("Inventory shows a Location column and filters on it", async ({ page }) => {
    await page.goto("/inventory");
    await waitForTable(page);

    await expect(page.locator("table thead th").filter({ hasText: /^Location$/ })).toHaveCount(1);
    await expect(page.locator("#inventory-location-filter")).toBeVisible();
    await expect(page.getByLabel("Minimum available quantity")).toBeVisible();
    await expect(page.getByLabel("Maximum available quantity")).toBeVisible();
  });

  test("Inventory dialog captures a location", async ({ page }) => {
    await page.goto("/inventory");
    await waitForTable(page);
    await page.getByRole("button", { name: /New Model/ }).click();

    const dialog = page.locator("div.fixed.inset-0").filter({ hasText: "New Generator Model" });
    await expect(dialog).toBeVisible();
    // The 11-Aug change request (point 9) replaced the free-text box with a
    // dropdown fed by the Location master list.
    const location = page.getByTestId("inventory-location");
    await expect(location).toBeVisible();
    expect(await location.evaluate((el) => el.tagName)).toBe("SELECT");
    await dialog.getByRole("button", { name: "Cancel" }).click();
  });

  test("Sales shows a Location column and location/quantity filters", async ({ page }) => {
    await page.goto("/sales");
    await expect(page.getByRole("heading", { name: "Sales" })).toBeVisible();
    await expect(page.locator("table thead th").filter({ hasText: /^Location$/ })).toHaveCount(1);
    await expect(page.locator("table thead th").filter({ hasText: /^Qty$/ })).toHaveCount(1);
    await expect(page.locator("#sale-location-filter")).toBeVisible();
    await expect(page.getByLabel("Minimum quantity")).toBeVisible();
  });
});

test.describe("Dashboard still renders with the new statuses", () => {
  test("the pipeline tiles read New / Open / Won / Lost", async ({ page }) => {
    await page.goto("/dashboard");
    // Asserts the page rendered, not the wording of its greeting. The old
    // "Welcome back" hero was removed in the redesign, and pinning a test to
    // decorative copy is how a styling change turns into a red suite.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    for (const label of ["New", "Open", "Won", "Lost"]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByText("In Progress", { exact: true })).toHaveCount(0);
  });
});
