import { test, expect, type APIRequestContext } from "@playwright/test";
import {
  API,
  RUN_TAG,
  adminApi,
  createLead,
  sweepRunFixtures,
  uiLogin,
  waitForTable,
} from "./helpers";

/**
 * 11 August change request — browser behaviour in Chromium.
 *
 * Point 1 — WhatsApp / email / call buttons on the lead row
 * Point 2 — sending a document, with the PDF reaching the customer
 * Point 4 — the Templates section, and the T&C picker on a quotation
 * Point 7 — lead import showing its format instructions first
 * Point 8 — Received first, with a date window
 * Point 9 — Location as a dropdown, and its master screen
 */

let ctx: APIRequestContext;
const cleanup: { path: string; id: string }[] = [];
const track = (path: string, id: string) => cleanup.push({ path, id });

test.beforeAll(async () => {
  ({ ctx } = await adminApi());
});

test.afterAll(async () => {
  for (const c of [...cleanup].reverse()) {
    await ctx.delete(`${API}/${c.path}/${c.id}`).catch(() => undefined);
  }
  await sweepRunFixtures(ctx);
  await ctx.dispose();
});

test.beforeEach(async ({ page }) => {
  await uiLogin(page);
});

test.describe("Point 1 — reach the customer from the lead row", () => {
  test("WhatsApp, email and call buttons are on every row", async ({ page }) => {
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} Reachable` });
    track("leads", lead.id);

    await page.goto("/leads");
    await page.getByPlaceholder("Customer, mobile, city, requirement...").fill(RUN_TAG);
    await waitForTable(page);

    await expect(page.getByTestId(`whatsapp-${lead.id}`)).toBeVisible();
    await expect(page.getByTestId(`email-${lead.id}`)).toBeVisible();
    // Click-to-call dials the number the lead was created with.
    await expect(page.getByTestId(`call-${lead.id}`)).toHaveAttribute("href", "tel:9876500001");
  });

  test("the WhatsApp dialog says plainly how the message will be sent", async ({ page }) => {
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} SendDialog` });
    track("leads", lead.id);

    await page.goto("/leads");
    await page.getByPlaceholder("Customer, mobile, city, requirement...").fill(RUN_TAG);
    await waitForTable(page);
    await page.getByTestId(`whatsapp-${lead.id}`).click();

    const dialog = page.getByTestId("send-message");
    await expect(dialog).toBeVisible();
    await expect(page.locator("#send-to")).toHaveValue("9876500001");

    // Without credentials the dialog must not imply the CRM will send it.
    const note = page.getByTestId("send-mode-note");
    await expect(note).toBeVisible();
    const caps = await (await ctx.get(`${API}/messages/capabilities`)).json();
    if (caps.data.whatsapp.configured) {
      await expect(note).toContainText("Sent directly from the CRM");
    } else {
      await expect(note).toContainText("not connected yet");
      await expect(page.getByRole("button", { name: "Prepare & Open" })).toBeVisible();
    }
  });
});

test.describe("Point 2 — send the document itself", () => {
  test("a quotation row offers WhatsApp and email, and attaches the document", async ({ page }) => {
    const doc = (
      await (
        await ctx.post(`${API}/quotations`, {
          data: {
            docType: "quotation",
            customerName: `${RUN_TAG} DocShare`,
            customerMobile: "9876500222",
            items: [{ description: "15 kVA genset", quantity: 1, unitPrice: 170000, taxRate: 18 }],
          },
        })
      ).json()
    ).data;
    track("quotations", doc.id);

    await page.goto("/quotations");
    await waitForTable(page);
    await page.getByPlaceholder("Search by customer or number...").fill(RUN_TAG);
    await waitForTable(page);

    await page.getByTestId(`share-whatsapp-${doc.id}`).click();
    const dialog = page.getByTestId("send-message");
    await expect(dialog).toBeVisible();
    // The document rides along, as an attachment or a secure link.
    await expect(dialog).toContainText(doc.docNumberFormatted);
    await expect(dialog).toContainText(/attached as a PDF|secure link/);
  });
});

test.describe("Point 4 — the Templates section", () => {
  test("has a tab per kind and creates a template", async ({ page }) => {
    await page.goto("/templates");
    await expect(page.getByTestId("templates-page")).toBeVisible();

    for (const k of ["description", "terms", "whatsapp", "email"] as const) {
      await expect(page.getByTestId(`template-tab-${k}`)).toBeVisible();
    }

    await page.getByTestId("template-tab-terms").click();
    await page.getByTestId("new-template").click();
    await page.locator("#tpl-name").fill(`${RUN_TAG} UI Terms`);
    await page.locator("#tpl-body").fill("50% advance with the order.\nBalance before dispatch.");
    await page.getByRole("button", { name: "Create Template" }).click();

    await expect(page.getByText(`${RUN_TAG} UI Terms`)).toBeVisible();

    const list = await ctx.get(`${API}/templates?kind=terms&search=${RUN_TAG} UI&limit=5`);
    const items = (await list.json()).data as Array<{ id: string; lines: string[] }>;
    expect(items).toHaveLength(1);
    track("templates", items[0].id);
    expect(items[0].lines).toHaveLength(2);
  });

  test("a T&C template can be applied to a quotation", async ({ page }) => {
    const t = (
      await (
        await ctx.post(`${API}/templates`, {
          data: {
            kind: "terms",
            name: `${RUN_TAG} Applied`,
            body: "Special term one.\nSpecial term two.",
            isDefault: true,
          },
        })
      ).json()
    ).data;
    track("templates", t.id);

    await page.goto("/quotations");
    await waitForTable(page);
    await page.getByRole("button", { name: /New Quotation/ }).click();

    const picker = page.getByTestId("terms-template-picker");
    await expect(picker).toBeVisible();
    await picker.selectOption(t.id);

    // The terms box is replaced by the template's text.
    const terms = page.locator("#terms-text");
    await expect(terms).toHaveValue("Special term one.\nSpecial term two.");
  });
});

test.describe("Point 7 — lead import shows the format first", () => {
  test("the dialog lists the columns and which are required", async ({ page }) => {
    await page.goto("/leads");
    await waitForTable(page);
    await page.getByTestId("open-lead-import").click();

    const dialog = page.getByTestId("lead-import");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("BEFORE YOU IMPORT");
    await expect(dialog).toContainText("Customer Name");
    await expect(dialog).toContainText("Required");
    await expect(dialog).toContainText("Save as .xlsx or .csv");
    await expect(page.getByTestId("download-import-template")).toBeVisible();
    await expect(page.getByTestId("choose-import-file")).toBeVisible();
  });
});

test.describe("Point 8 — Received first, with a date window", () => {
  test("Received is the first column and the window filters", async ({ page }) => {
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} FirstCol` });
    track("leads", lead.id);

    await page.goto("/leads");
    await waitForTable(page);

    const headers = (await page.locator("table thead th").allInnerTexts()).map((h) => h.trim());
    // Column 1 is the selection checkbox, 2 is Actions, so Received is 3rd.
    expect(headers[2]).toBe("Received");

    await page.getByPlaceholder("Customer, mobile, city, requirement...").fill(RUN_TAG);
    await waitForTable(page);
    await expect(page.locator("tbody tr", { hasText: `${RUN_TAG} FirstCol` })).toHaveCount(1);

    // A window that closed yesterday excludes a lead created today.
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    await page.getByTestId("lead-end-date").fill(yesterday);
    await waitForTable(page);
    await expect(page.locator("tbody tr", { hasText: `${RUN_TAG} FirstCol` })).toHaveCount(0);
  });
});

test.describe("Point 9 — Location is a dropdown from a master list", () => {
  test("the Locations screen creates one and it appears in Inventory", async ({ page }) => {
    await page.goto("/locations");
    await expect(page.getByTestId("locations-page")).toBeVisible();

    await page.getByTestId("new-location").click();
    await page.locator("#loc-name").fill(`${RUN_TAG} UI Yard`);
    await page.locator("#loc-city").fill("Mumbai");
    await page.getByRole("button", { name: "Create Location" }).click();
    await expect(page.getByText(`${RUN_TAG} UI Yard`)).toBeVisible();

    const list = await ctx.get(`${API}/locations?search=${RUN_TAG} UI&limit=5`);
    const items = (await list.json()).data as Array<{ id: string }>;
    expect(items).toHaveLength(1);
    track("locations", items[0].id);

    // It is now offered by the Inventory dialog's dropdown.
    await page.goto("/inventory");
    await waitForTable(page);
    await page.getByRole("button", { name: /New Model/ }).click();
    const select = page.getByTestId("inventory-location");
    await expect(select).toBeVisible();
    expect(await select.evaluate((el) => el.tagName)).toBe("SELECT");
    await expect(select.locator("option", { hasText: `${RUN_TAG} UI Yard` })).toHaveCount(1);
  });

  test("the Inventory and Sales filters use the same dropdown", async ({ page }) => {
    await page.goto("/inventory");
    await waitForTable(page);
    const invFilter = page.getByTestId("inventory-location-filter");
    await expect(invFilter).toBeVisible();
    await expect(invFilter.locator("option").first()).toHaveText("All locations");

    await page.goto("/sales");
    await expect(page.getByRole("heading", { name: "Sales" })).toBeVisible();
    await expect(page.getByTestId("sale-location-filter")).toBeVisible();
  });
});

test.describe("Point 6 — letterhead is configurable from Settings", () => {
  test("Settings offers header, footer and signature artwork", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText("Letterhead (PDF header & footer)")).toBeVisible();
    // Either a chooser (unset) or the current artwork is shown for each slot.
    for (const slot of ["header", "footer", "signature"] as const) {
      const chooser = page.getByTestId(`pick-${slot}`);
      const hasChooser = (await chooser.count()) > 0;
      if (!hasChooser) {
        // Already configured — the image is rendered instead.
        await expect(page.locator(`img[alt*="${slot}" i]`).first()).toBeVisible();
      } else {
        await expect(chooser).toBeVisible();
      }
    }
    await expect(page.getByText(/prints twice/)).toBeVisible();
  });
});

test.describe("Point 4 — calculate first, then create the quotation", () => {
  test("the calculator hands the sizing and the customer to a quotation", async ({ page }) => {
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} SizeMe` });
    track("leads", lead.id);

    // Arrive the way a salesperson does: from the lead's own Calculate button.
    await page.goto(`/leads/${lead.id}`);
    await expect(page.getByTestId("lead-detail")).toBeVisible();
    await page.getByTestId("detail-calculate").click();

    await expect(page.getByTestId("calc-for-lead")).toContainText(`${RUN_TAG} SizeMe`);

    // Nothing to quote until a load has actually been calculated.
    await expect(page.getByTestId("calc-to-quote")).toHaveCount(0);
    await page.getByRole("button", { name: "Calculate" }).click();
    const panel = page.getByTestId("calc-to-quote");
    await expect(panel).toBeVisible();

    await page.getByTestId("calc-create-quotation").click();

    // The document opens pre-filled: this customer, the calculated size.
    const dialog = page.getByRole("dialog", { name: "New Document" });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("input[name='customerName']")).toHaveValue(`${RUN_TAG} SizeMe`);
    const description = dialog.locator("#item-description-0");
    await expect(description).toHaveValue(/kVA/);
    await expect(description).toHaveValue(/running load/i);
  });

  test("a catalog genset big enough for the load carries its price across", async ({ page }) => {
    const product = (
      await (
        await ctx.post(`${API}/products`, {
          data: {
            name: `${RUN_TAG} Suggested 125`,
            kva: 125,
            price: 940000,
            longDescription: `${RUN_TAG} 125 kVA silent diesel generating set`,
          },
        })
      ).json()
    ).data;
    track("products", product.id);

    await page.goto("/capacity-calculator");
    // A load far above the starter rows, so this 125 kVA set is a candidate.
    await page.getByRole("button", { name: "Add appliance" }).click();
    const lastRow = page.locator("tbody tr").last();
    await lastRow.locator("input[type=number]").first().fill("1");
    await lastRow.locator("input[type=number]").last().fill("60000");
    await page.getByRole("button", { name: "Calculate" }).click();

    const pick = page.getByTestId(`pick-genset-${product.id}`);
    await expect(pick).toBeVisible();
    await pick.check();
    await page.getByTestId("calc-create-quotation").click();

    const dialog = page.getByRole("dialog", { name: "New Document" });
    await expect(dialog.locator("#item-description-0")).toHaveValue(
      new RegExp(`${RUN_TAG} 125 kVA`),
    );
    await expect(dialog.locator("input[name='items.0.unitPrice']")).toHaveValue("940000");
  });
});
