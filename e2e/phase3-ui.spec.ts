import { test, expect, type APIRequestContext } from "@playwright/test";
import { API, RUN_TAG, adminApi, sweepRunFixtures, uiLogin, waitForTable } from "./helpers";

/**
 * Change Request Phase 3 — browser behaviour in Chromium.
 *
 * Point 10 — the Tax Invoice tab, PI → Invoice conversion, issue-and-lock
 * Point 6  — Ship To block and "auto fetch" of a customer's last document
 * Point 15 — the four-step "create your customized quotation" wizard
 */

let ctx: APIRequestContext;
const docIds: string[] = [];
const productIds: string[] = [];

test.beforeAll(async () => {
  ({ ctx } = await adminApi());
});

test.afterAll(async () => {
  for (const id of docIds) await ctx.delete(`${API}/quotations/${id}`).catch(() => undefined);
  for (const id of productIds) await ctx.delete(`${API}/products/${id}`).catch(() => undefined);
  await sweepRunFixtures(ctx);
  await ctx.dispose();
});

test.beforeEach(async ({ page }) => {
  await uiLogin(page);
});

async function seedDoc(overrides: Record<string, unknown> = {}) {
  const res = await ctx.post(`${API}/quotations`, {
    data: {
      docType: "proforma",
      customerName: `${RUN_TAG} Acme`,
      customerMobile: "9768412305",
      customerGstin: "29ABCDE1234F1Z5",
      customerState: "Karnataka",
      customerAddress: "Plot 14, Peenya, Bengaluru",
      items: [
        {
          description: "125 kVA Silent Diesel Generator Set",
          hsnCode: "84079090",
          quantity: 1,
          unitPrice: 950000,
          taxRate: 18,
        },
      ],
      ...overrides,
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  const doc = (await res.json()).data;
  docIds.push(doc.id);
  return doc;
}

async function seedProduct(overrides: Record<string, unknown> = {}) {
  const res = await ctx.post(`${API}/products`, {
    data: {
      name: `${RUN_TAG} Wizard Genset`,
      brand: "Mahindra",
      modelCode: `${RUN_TAG}-WZ`,
      kva: 15,
      price: 170000,
      taxRate: 18,
      unit: "Piece",
      longDescription: "15 kVA Mahindra Powerol portable generator, water cooled.",
      specs: [{ label: "Power", value: "15 kVA" }],
      ...overrides,
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  const p = (await res.json()).data;
  productIds.push(p.id);
  return p;
}

test.describe("Point 10 — Tax Invoice tab and lifecycle", () => {
  test("the third tab exists alongside Quotations and Proforma Invoices", async ({ page }) => {
    await page.goto("/quotations");
    await waitForTable(page);
    for (const label of ["Quotations", "Proforma Invoices", "Tax Invoices"]) {
      await expect(page.getByRole("button", { name: label, exact: true })).toBeVisible();
    }
  });

  test("a tax invoice shows its FY-based number and a draft is editable", async ({ page }) => {
    const inv = await seedDoc({ docType: "invoice" });

    await page.goto("/quotations");
    await page.getByRole("button", { name: "Tax Invoices", exact: true }).click();
    await waitForTable(page);
    await page.getByPlaceholder("Search by customer or number...").fill(RUN_TAG);
    await waitForTable(page);

    const row = page.locator("tbody tr", { hasText: inv.docNumberFormatted }).first();
    await expect(row).toBeVisible();
    // INV/2026-27/0001
    await expect(row).toContainText(/\/\d{4}-\d{2}\//);
    await expect(row).not.toContainText("Issued");
  });

  test("converting a proforma produces a tax invoice and switches to that tab", async ({
    page,
  }) => {
    const pi = await seedDoc();

    await page.goto("/quotations");
    await waitForTable(page);
    await page.getByRole("button", { name: "Proforma Invoices", exact: true }).click();
    await waitForTable(page);
    await page.getByPlaceholder("Search by customer or number...").fill(RUN_TAG);
    await waitForTable(page);

    await page.getByTestId(`convert-${pi.id}`).click();

    // The page flips to the Tax Invoices tab and the new document is listed.
    await expect(page.getByRole("heading", { name: "Tax Invoices" })).toBeVisible();
    await waitForTable(page);
    await page.getByPlaceholder("Search by customer or number...").fill(RUN_TAG);
    await waitForTable(page);
    await expect(page.locator("tbody tr").filter({ hasText: /\/\d{4}-\d{2}\// })).not.toHaveCount(
      0,
    );

    // Track the created invoice for cleanup.
    const list = await ctx.get(`${API}/quotations?docType=invoice&search=${RUN_TAG}&limit=20`);
    for (const d of (await list.json()).data as Array<{ id: string }>) docIds.push(d.id);
  });

  test("issuing locks the invoice: confirm, badge, and Edit disabled", async ({ page }) => {
    const inv = await seedDoc({ docType: "invoice" });

    await page.goto("/quotations");
    await page.getByRole("button", { name: "Tax Invoices", exact: true }).click();
    await waitForTable(page);
    await page.getByPlaceholder("Search by customer or number...").fill(RUN_TAG);
    await waitForTable(page);

    await page.getByTestId(`issue-${inv.id}`).click();

    // Irreversible, so it must warn before doing it.
    const confirm = page.locator("div.fixed.inset-0").filter({ hasText: "Issue " });
    await expect(confirm).toContainText("cannot be edited or deleted");
    await confirm.getByRole("button", { name: "Issue Invoice" }).click();

    const row = page.locator("tbody tr", { hasText: inv.docNumberFormatted }).first();
    await expect(row).toContainText("Issued");
    // Edit is disabled, and the Issue button is gone.
    await expect(row.getByRole("button", { name: "Edit" })).toBeDisabled();
    await expect(page.getByTestId(`issue-${inv.id}`)).toHaveCount(0);
  });
});

test.describe("Point 6 — Ship To and auto-fetch", () => {
  test("the ship-to fields appear only when 'same as billing' is unticked", async ({ page }) => {
    await page.goto("/quotations");
    await waitForTable(page);
    await page.getByRole("button", { name: /New Quotation/ }).click();

    const dialog = page.locator("div.fixed.inset-0").filter({ hasText: "New Document" });
    await expect(dialog).toBeVisible();

    // Collapsed by default.
    await expect(dialog.getByText("The document will repeat the Bill To block")).toBeVisible();
    await expect(dialog.getByPlaceholder("Delivery address")).toHaveCount(0);

    await page.getByTestId("ship-to-same").uncheck();
    await expect(dialog.getByPlaceholder("Delivery address")).toBeVisible();
    await expect(dialog.getByPlaceholder("Contact person")).toBeVisible();

    await dialog.getByRole("button", { name: "Cancel" }).click();
  });

  test("auto-fetch fills the billing and shipping block from the last document", async ({
    page,
  }) => {
    await seedDoc({
      customerMobile: "9812345671",
      shipToSameAsBilling: false,
      shipToName: `${RUN_TAG} Depot`,
      shipToAddress: "Warehouse Road, Hoskote",
      shipToContactPerson: "Sharik",
    });

    await page.goto("/quotations");
    await waitForTable(page);
    await page.getByRole("button", { name: /New Quotation/ }).click();
    const dialog = page.locator("div.fixed.inset-0").filter({ hasText: "New Document" });

    await dialog.getByPlaceholder("Mobile").fill("9812345671");
    await page.getByTestId("auto-fetch-customer").click();

    await expect(dialog.getByPlaceholder("Customer name *")).toHaveValue(`${RUN_TAG} Acme`);
    // exact — "GSTIN" and "State" would otherwise also match the ship-to fields.
    await expect(dialog.getByPlaceholder("GSTIN", { exact: true })).toHaveValue("29ABCDE1234F1Z5");
    await expect(dialog.getByPlaceholder("State", { exact: true })).toHaveValue("Karnataka");
    // ...including the ship-to block, which unticks the checkbox.
    await expect(page.getByTestId("ship-to-same")).not.toBeChecked();
    await expect(dialog.getByPlaceholder("Ship-to name")).toHaveValue(`${RUN_TAG} Depot`);
    await expect(dialog.getByPlaceholder("Contact person")).toHaveValue("Sharik");

    await dialog.getByRole("button", { name: "Cancel" }).click();
  });

  test("auto-fetch reports when there is nothing to fetch", async ({ page }) => {
    await page.goto("/quotations");
    await waitForTable(page);
    await page.getByRole("button", { name: /New Quotation/ }).click();
    const dialog = page.locator("div.fixed.inset-0").filter({ hasText: "New Document" });

    await dialog.getByPlaceholder("Mobile").fill("0000000000");
    await page.getByTestId("auto-fetch-customer").click();
    await expect(page.getByText("No earlier document found for this customer")).toBeVisible();

    await dialog.getByRole("button", { name: "Cancel" }).click();
  });
});

test.describe("Point 15 — the customized quotation wizard", () => {
  test("walks all four steps and generates a document", async ({ page }) => {
    const product = await seedProduct();

    await page.goto("/quotations");
    await waitForTable(page);
    await page.getByTestId("open-wizard").click();

    const wizard = page.getByTestId("quotation-wizard");
    await expect(wizard).toBeVisible();
    // Each step button is "<n> <label>", so match the button rather than an
    // element whose text is exactly the label.
    const stepLabels = ["Select Product", "Terms & Conditions", "Verify Details", "Generate"];
    for (const [i, label] of stepLabels.entries()) {
      await expect(page.getByTestId(`wizard-step-${i + 1}`)).toContainText(label);
    }

    // Step 1 — pick from the catalog.
    await wizard.getByLabel("Search your catalog").fill(RUN_TAG);
    await page.getByTestId(`wizard-product-${product.id}`).click();
    await expect(wizard.getByLabel(`Quantity for ${product.name}`)).toHaveValue("1");
    await wizard.getByLabel(`Quantity for ${product.name}`).fill("3");

    // Step 2 — terms are pre-filled and editable.
    await page.getByTestId("wizard-next").click();
    await expect(page.locator("#wizard-terms")).toContainText("Prices are inclusive of GST");
    await page.locator("#wizard-terms").fill("Custom term one\nCustom term two");

    // Step 3 — customer block.
    await page.getByTestId("wizard-next").click();
    await page.locator("#wizard-customer-name").fill(`${RUN_TAG} Wizard Customer`);
    await page.locator("#wizard-customerMobile").fill("9990001111");

    // Step 4 — summary reflects 3 × 170000 = 510000 taxable, 18% = 91800.
    await page.getByTestId("wizard-next").click();
    await expect(wizard).toContainText("5,10,000");
    await expect(wizard).toContainText("91,800");
    await expect(wizard).toContainText("6,01,800");

    await page.getByTestId("wizard-generate").click();
    await expect(wizard).toBeHidden();

    // The document exists, with the wizard's overrides applied.
    const list = await ctx.get(`${API}/quotations?search=${RUN_TAG} Wizard&limit=10`);
    const items = (await list.json()).data as Array<{
      id: string;
      grandTotal: number;
      terms: string[];
      items: { quantity: number; product?: string | null; specs?: unknown[] }[];
    }>;
    expect(items).toHaveLength(1);
    docIds.push(items[0].id);
    expect(items[0].grandTotal).toBe(601800);
    expect(items[0].terms).toEqual(["Custom term one", "Custom term two"]);
    expect(items[0].items[0].quantity).toBe(3);
    // The catalog snapshot came along, so the PDF can print the spec block.
    expect(items[0].items[0].specs).toHaveLength(1);
  });

  test("Quick Generate skips the middle steps", async ({ page }) => {
    const product = await seedProduct({ name: `${RUN_TAG} Quick Genset` });

    await page.goto("/quotations");
    await waitForTable(page);
    await page.getByTestId("open-wizard").click();

    const wizard = page.getByTestId("quotation-wizard");
    await wizard.getByLabel("Search your catalog").fill(RUN_TAG);
    await page.getByTestId(`wizard-product-${product.id}`).click();

    // No customer yet — Quick Generate must send us to Verify Details, not fail.
    await page.getByTestId("wizard-quick-generate").click();
    await expect(page.locator("#wizard-customer-name")).toBeVisible();

    await page.locator("#wizard-customer-name").fill(`${RUN_TAG} Quick Customer`);
    await page.getByTestId("wizard-quick-generate").click();
    await expect(wizard).toBeHidden();

    const list = await ctx.get(`${API}/quotations?search=${RUN_TAG} Quick&limit=10`);
    const items = (await list.json()).data as Array<{ id: string; grandTotal: number }>;
    expect(items).toHaveLength(1);
    docIds.push(items[0].id);
    expect(items[0].grandTotal).toBe(200600); // 170000 + 18%
  });

  test("cannot advance past step 1 without picking a product", async ({ page }) => {
    await page.goto("/quotations");
    await waitForTable(page);
    await page.getByTestId("open-wizard").click();

    await expect(page.getByTestId("wizard-next")).toBeDisabled();
    await expect(page.getByTestId("wizard-quick-generate")).toBeDisabled();
  });
});
