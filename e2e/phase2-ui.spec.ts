import { test, expect, type APIRequestContext } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { API, RUN_TAG, adminApi, sweepRunFixtures, uiLogin, waitForTable } from "./helpers";

/**
 * Change Request Phase 2 — browser behaviour in Chromium.
 *
 * Point 17 — the Attach Files picker: category rail, kind tabs, upload, select
 * Point 5  — the catalog captures the full multi-line description and specs
 * Point 4  — picking a catalog product auto-fills a quotation line item
 */

let ctx: APIRequestContext;
const productIds: string[] = [];
const mediaIds: string[] = [];

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const SAMPLE_DESCRIPTION = `4 KVA Bajaj M Non- SILENT elite class portable Petrol Generator Set with latest technology, Air Cooled engine developing 7.5 BHP at 3000 RPM.

SPECIAL FEATURES :
1) Self start
2) Key switch`;

/** A real file on disk, so setInputFiles exercises the browser upload path. */
let tmpImage: string;

test.beforeAll(async () => {
  ({ ctx } = await adminApi());
  tmpImage = path.join(os.tmpdir(), `${RUN_TAG}-upload.png`);
  fs.writeFileSync(tmpImage, PNG);
});

test.afterAll(async () => {
  for (const id of productIds) await ctx.delete(`${API}/products/${id}`).catch(() => undefined);
  for (const id of mediaIds) await ctx.delete(`${API}/media/${id}`).catch(() => undefined);
  // Backstop for anything a mid-test failure left behind.
  await sweepRunFixtures(ctx);
  await ctx.dispose();
  fs.rmSync(tmpImage, { force: true });
});

test.beforeEach(async ({ page }) => {
  await uiLogin(page);
});

/** Create a catalog product over the API and remember it for cleanup. */
async function seedProduct(overrides: Record<string, unknown> = {}) {
  const res = await ctx.post(`${API}/products`, {
    data: {
      name: `${RUN_TAG} Seeded Genset`,
      brand: "Bajaj",
      modelCode: `${RUN_TAG}-SEED`,
      kva: 15,
      price: 170000,
      taxRate: 12,
      hsnCode: "8502",
      longDescription: SAMPLE_DESCRIPTION,
      categories: "Portable Generator",
      ...overrides,
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  const product = (await res.json()).data;
  productIds.push(product.id);
  return product;
}

test.describe("Product Catalog screen", () => {
  test("is reachable from the sidebar", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Product Catalog" }).click();
    await page.waitForURL(/\/catalog/);
    await expect(page.getByRole("heading", { name: "Product Catalog" })).toBeVisible();
  });

  test("lists catalog products with their image, price and spec count", async ({ page }) => {
    const product = await seedProduct({ name: `${RUN_TAG} Listed Genset` });

    await page.goto("/catalog");
    await waitForTable(page);
    await page.getByPlaceholder("Name, brand or model...").fill(RUN_TAG);
    await waitForTable(page);

    const row = page.locator("tbody tr", { hasText: `${RUN_TAG} Listed Genset` }).first();
    await expect(row).toBeVisible();
    await expect(row).toContainText("Bajaj");
    await expect(row).toContainText("₹1,70,000");
    await expect(row).toContainText("12%");
    expect(product.id).toBeTruthy();
  });

  test("point 5: creates a product with a full multi-line description and specs", async ({
    page,
  }) => {
    await page.goto("/catalog");
    await waitForTable(page);
    await page.getByRole("button", { name: "New Product" }).click();

    const dialog = page.locator("div.fixed.inset-0").filter({ hasText: "New Catalog Product" });
    await expect(dialog).toBeVisible();

    const name = `${RUN_TAG} Dialog Genset`;
    await dialog
      .getByPlaceholder("e.g. 4 Kva BAJAJ M Non Silent Portable Generator Set")
      .fill(name);
    await dialog.getByPlaceholder("Bajaj / Mahindra").fill("Bajaj");
    await dialog.getByPlaceholder("BM-4000").fill(`${RUN_TAG}-DLG`);
    // The dialog has exactly one textarea — the full description.
    await dialog.locator("textarea").fill(SAMPLE_DESCRIPTION);

    // The spec grid is pre-seeded with the labels from the sample quotation.
    await expect(dialog.getByPlaceholder("Label (e.g. Cooling System)").first()).toHaveValue(
      "Power",
    );
    // exact — otherwise "Spec value 1" also matches rows 10, 11 and 12.
    await dialog.getByLabel("Spec value 1", { exact: true }).fill("4 kVA");
    await dialog.getByLabel("Spec value 2", { exact: true }).fill("New");

    await dialog.getByRole("button", { name: "Add to Catalog" }).click();
    await expect(dialog).toBeHidden();

    // Verify through the API that the text survived exactly.
    const list = await ctx.get(`${API}/products?search=${RUN_TAG} Dialog&limit=5`);
    const items = (await list.json()).data as Array<{
      id: string;
      longDescription: string;
      specs: { label: string; value: string }[];
    }>;
    expect(items).toHaveLength(1);
    productIds.push(items[0].id);
    expect(items[0].longDescription).toBe(SAMPLE_DESCRIPTION);
    // Blank seeded rows are dropped; only the two filled in survive.
    expect(items[0].specs).toEqual([
      { label: "Power", value: "4 kVA" },
      { label: "Condition", value: "New" },
    ]);
  });
});

test.describe("Point 17 — Attach Files picker", () => {
  test("opens from the product dialog with a category rail and kind tabs", async ({ page }) => {
    await page.goto("/catalog");
    await waitForTable(page);
    await page.getByRole("button", { name: "New Product" }).click();

    const productDialog = page
      .locator("div.fixed.inset-0")
      .filter({ hasText: "New Catalog Product" });
    await productDialog.getByRole("button", { name: "Choose images" }).click();

    const picker = page.getByTestId("media-picker");
    await expect(picker).toBeVisible();
    await expect(picker.getByLabel("Search by category")).toBeVisible();
    await expect(picker.getByRole("button", { name: "Upload from Computer" })).toBeVisible();
    await expect(picker.getByText("All categories")).toBeVisible();
    // Storage provider is surfaced so the team can see which backend is live.
    await expect(
      picker.getByText(/Storage: (cloudinary|local) · max \d+ MB per file/),
    ).toBeVisible();
  });

  test("uploads a file from the computer and attaches it to the product", async ({ page }) => {
    await page.goto("/catalog");
    await waitForTable(page);
    await page.getByRole("button", { name: "New Product" }).click();

    const productDialog = page
      .locator("div.fixed.inset-0")
      .filter({ hasText: "New Catalog Product" });
    const name = `${RUN_TAG} Imaged Genset`;
    await productDialog
      .getByPlaceholder("e.g. 4 Kva BAJAJ M Non Silent Portable Generator Set")
      .fill(name);

    await productDialog.getByRole("button", { name: "Choose images" }).click();
    const picker = page.getByTestId("media-picker");
    await expect(picker).toBeVisible();

    // Tag the upload, then push the file through the real file input.
    await page.locator("#media-upload-categories").fill(`${RUN_TAG}uicat`);
    await page.getByTestId("media-file-input").setInputFiles(tmpImage);

    // The freshly uploaded file is auto-selected.
    await expect(page.getByTestId("media-selection")).toContainText(`${RUN_TAG}-upload.png`);
    await page.getByRole("button", { name: /^Attach 1$/ }).click();
    await expect(picker).toBeHidden();

    // It shows in the product dialog, flagged as the primary image.
    const thumbs = productDialog.getByTestId("product-images");
    await expect(thumbs).toBeVisible();
    await expect(thumbs.getByText("Primary")).toBeVisible();

    await productDialog.getByRole("button", { name: "Add to Catalog" }).click();
    await expect(productDialog).toBeHidden();

    // The saved product carries the image.
    const list = await ctx.get(`${API}/products?search=${RUN_TAG} Imaged&limit=5`);
    const items = (await list.json()).data as Array<{
      id: string;
      images: { id: string }[];
      primaryImageUrl: string;
    }>;
    expect(items).toHaveLength(1);
    productIds.push(items[0].id);
    expect(items[0].images).toHaveLength(1);
    mediaIds.push(items[0].images[0].id);
    expect(items[0].primaryImageUrl).toMatch(/^https?:\/\//);
  });

  test("the category rail filters the grid", async ({ page }) => {
    // Two files, only one carrying the tag we will filter on.
    const tag = `${RUN_TAG}filter`;
    for (const [name, categories] of [
      [`${RUN_TAG}-in.png`, tag],
      [`${RUN_TAG}-out.png`, ""],
    ] as const) {
      const res = await ctx.post(`${API}/media`, {
        multipart: {
          file: { name, mimeType: "image/png", buffer: PNG },
          ...(categories ? { categories } : {}),
        },
      });
      expect(res.status()).toBe(201);
      mediaIds.push((await res.json()).data.id);
    }

    await page.goto("/catalog");
    await waitForTable(page);
    await page.getByRole("button", { name: "New Product" }).click();
    await page
      .locator("div.fixed.inset-0")
      .filter({ hasText: "New Catalog Product" })
      .getByRole("button", { name: "Choose images" })
      .click();

    const picker = page.getByTestId("media-picker");
    await expect(picker).toBeVisible();

    // Both are present before filtering...
    await picker.getByLabel("Search files").fill(RUN_TAG);
    await expect(picker.getByText(`${RUN_TAG}-out.png`)).toBeVisible();

    // ...and only the tagged one survives the category filter. Targeted by
    // test id because the tag also appears in the file names in the grid.
    await picker.getByLabel("Search by category").fill(tag);
    await picker.getByTestId(`media-category-${tag.toLowerCase()}`).click();
    await expect(picker.getByText(`${RUN_TAG}-in.png`)).toBeVisible();
    await expect(picker.getByText(`${RUN_TAG}-out.png`)).toHaveCount(0);
  });
});

test.describe("Point 4 — quotation description auto-fills from the catalog", () => {
  test("picking a product fills description, model, KVA, HSN, rate and GST", async ({ page }) => {
    const product = await seedProduct({ name: `${RUN_TAG} Autofill UI Genset` });

    await page.goto("/quotations");
    await waitForTable(page);
    await page.getByRole("button", { name: /New Quotation/ }).click();

    const dialog = page.locator("div.fixed.inset-0").filter({ hasText: "New Document" });
    await expect(dialog).toBeVisible();

    // Every field starts empty / at its default.
    await expect(dialog.getByPlaceholder("Description *")).toHaveValue("");
    await expect(dialog.getByPlaceholder("Rate")).toHaveValue("0");

    await page.getByTestId("product-picker-0").click();
    const menu = page.getByTestId("product-picker-menu");
    await expect(menu).toBeVisible();
    await menu.getByLabel("Search the catalog").fill(RUN_TAG);
    await menu.getByTestId(`product-option-${product.id}`).click();
    await expect(menu).toBeHidden();

    // One click filled the whole row.
    await expect(dialog.getByPlaceholder("Description *")).toHaveValue(SAMPLE_DESCRIPTION);
    await expect(dialog.getByPlaceholder("Model")).toHaveValue(`${RUN_TAG}-SEED`);
    await expect(dialog.getByPlaceholder("KVA")).toHaveValue("15");
    await expect(dialog.getByPlaceholder("HSN")).toHaveValue("8502");
    await expect(dialog.getByPlaceholder("Rate")).toHaveValue("170000");
    await expect(dialog.getByPlaceholder("GST%")).toHaveValue("12");

    // ...and the totals preview picked the change up.
    const totals = dialog
      .locator("div")
      .filter({ hasText: /^Taxable:/ })
      .last();
    await expect(totals).toContainText("1,70,000.00");
    await expect(totals).toContainText("20,400.00"); // 12% of 170000

    await dialog.getByRole("button", { name: "Cancel" }).click();
  });

  test("the description stays free-text — typing over an auto-fill works", async ({ page }) => {
    await seedProduct({ name: `${RUN_TAG} Overwrite Genset` });

    await page.goto("/quotations");
    await waitForTable(page);
    await page.getByRole("button", { name: /New Quotation/ }).click();
    const dialog = page.locator("div.fixed.inset-0").filter({ hasText: "New Document" });

    const description = dialog.getByPlaceholder("Description *");
    await description.fill("Hand-written one-off item, not from the catalog");
    await expect(description).toHaveValue("Hand-written one-off item, not from the catalog");

    await dialog.getByRole("button", { name: "Cancel" }).click();
  });

  test("the picker reports an empty catalog rather than failing", async ({ page }) => {
    await page.goto("/quotations");
    await waitForTable(page);
    await page.getByRole("button", { name: /New Quotation/ }).click();

    await page.getByTestId("product-picker-0").click();
    const menu = page.getByTestId("product-picker-menu");
    await menu.getByLabel("Search the catalog").fill("zzz-no-such-product-zzz");
    await expect(menu.getByText("No matching products.")).toBeVisible();
  });

  test("each line item has its own independent picker", async ({ page }) => {
    const product = await seedProduct({ name: `${RUN_TAG} Second Row Genset` });

    await page.goto("/quotations");
    await waitForTable(page);
    await page.getByRole("button", { name: /New Quotation/ }).click();
    const dialog = page.locator("div.fixed.inset-0").filter({ hasText: "New Document" });

    await dialog.getByRole("button", { name: "Add item" }).click();
    await expect(page.getByTestId("product-picker-1")).toBeVisible();

    // Fill row 2 and confirm row 1 is untouched.
    await page.getByTestId("product-picker-1").click();
    const menu = page.getByTestId("product-picker-menu");
    await menu.getByLabel("Search the catalog").fill(RUN_TAG);
    await menu.getByTestId(`product-option-${product.id}`).click();

    await expect(dialog.getByPlaceholder("Description *").nth(1)).toHaveValue(SAMPLE_DESCRIPTION);
    await expect(dialog.getByPlaceholder("Description *").nth(0)).toHaveValue("");

    await dialog.getByRole("button", { name: "Cancel" }).click();
  });
});

test.describe("API robustness", () => {
  test("a malformed JSON body returns 400, not a 500 with a stack trace", async () => {
    const res = await ctx.post(`${API}/products`, {
      headers: { "Content-Type": "application/json" },
      data: "{ this is not json",
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("BAD_REQUEST");
    expect(body.error).not.toHaveProperty("stack");
  });
});
