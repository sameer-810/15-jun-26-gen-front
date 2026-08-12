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
 * The six IndiaMART reference examples attached to the 11 August list, checked
 * on their own rather than folded into the ten numbered points.
 *
 *  1 — WhatsApp template options
 *  2 — template with image and full description; rename, edit, add new
 *  3 — a lead opens showing these details
 *  4 — this is the way a quotation gets created
 *  5 — the generated quotation PDF
 *  6 — a way to add an image
 */

// A 1x1 PNG is enough for the upload path; the assertions are about wiring.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

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

test.describe("Examples 1 & 2 — a WhatsApp template with an image", () => {
  test("the template's picture travels with the message, and the edit survives", async () => {
    const up = await ctx.post(`${API}/media`, {
      multipart: { file: { name: `${RUN_TAG}-tpl.png`, mimeType: "image/png", buffer: PNG } },
    });
    expect(up.status()).toBe(201);
    const media = (await up.json()).data;
    track("media", media.id);

    const tpl = (
      await (
        await ctx.post(`${API}/templates`, {
          data: {
            kind: "whatsapp",
            name: `${RUN_TAG} With Image`,
            body: "Hello {{customerName}}, sharing our generator range.",
            imageId: media.id,
          },
        })
      ).json()
    ).data;
    track("templates", tpl.id);
    expect(tpl.imageUrl, "the template keeps its picture").toBeTruthy();

    const lead = await createLead(ctx, { customerName: `${RUN_TAG} ImgSend` });
    track("leads", lead.id);

    // Sent with the template AND an edited body: the edit wins, the picture rides along.
    const sent = await ctx.post(`${API}/messages`, {
      data: {
        leadId: lead.id,
        channel: "whatsapp",
        templateId: tpl.id,
        body: "Edited on the spot for {{customerName}}.",
      },
    });
    expect(sent.status(), await sent.text()).toBe(201);
    const msg = (await sent.json()).data;
    expect(msg.body).toBe(`Edited on the spot for ${RUN_TAG} ImgSend.`);
    expect(msg.imageUrl, "the template's picture is attached to the message").toBeTruthy();
    expect(msg.templateId).toBe(tpl.id);
  });

  test("the composer shows the picture that will be sent", async ({ page }) => {
    const up = await ctx.post(`${API}/media`, {
      multipart: { file: { name: `${RUN_TAG}-ui.png`, mimeType: "image/png", buffer: PNG } },
    });
    const media = (await up.json()).data;
    track("media", media.id);
    const tpl = (
      await (
        await ctx.post(`${API}/templates`, {
          data: {
            kind: "whatsapp",
            name: `${RUN_TAG} UI Image`,
            body: "Our range for {{customerName}}.",
            imageId: media.id,
            isDefault: true,
          },
        })
      ).json()
    ).data;
    track("templates", tpl.id);

    const lead = await createLead(ctx, { customerName: `${RUN_TAG} ImgUI` });
    track("leads", lead.id);

    await page.goto(`/leads/${lead.id}`);
    await page.getByTestId("detail-whatsapp").click();
    await page.locator("#send-template").selectOption(tpl.id);
    await expect(page.getByTestId("template-image-preview")).toBeVisible();
  });

  test("a template can be renamed and its wording rewritten", async ({ page }) => {
    const tpl = (
      await (
        await ctx.post(`${API}/templates`, {
          data: { kind: "whatsapp", name: `${RUN_TAG} Before`, body: "Original wording." },
        })
      ).json()
    ).data;
    track("templates", tpl.id);

    await page.goto("/templates");
    await page.getByTestId("template-tab-whatsapp").click();
    await expect(page.getByText(`${RUN_TAG} Before`)).toBeVisible();
    await page.getByTestId(`edit-template-${tpl.id}`).click();

    await page.locator("#tpl-name").fill(`${RUN_TAG} After`);
    await page.locator("#tpl-body").fill("Rewritten wording for the customer.");
    await page.getByRole("button", { name: "Save Changes" }).click();

    await expect(page.getByText(`${RUN_TAG} After`)).toBeVisible();
    const reread = (await (await ctx.get(`${API}/templates/${tpl.id}`)).json()).data;
    expect(reread.name).toBe(`${RUN_TAG} After`);
    expect(reread.body).toBe("Rewritten wording for the customer.");
  });
});

test.describe("Examples 3, 4 & 5 — lead detail, quotation build, PDF", () => {
  test("a lead opens on its own screen with the details the example shows", async ({ page }) => {
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} Detail` });
    track("leads", lead.id);

    await page.goto("/leads");
    await page.getByPlaceholder("Customer, mobile, city, requirement...").fill(RUN_TAG);
    await waitForTable(page);
    await page.getByText(`${RUN_TAG} Detail`).first().click();

    const detail = page.getByTestId("lead-detail");
    await expect(detail).toBeVisible();
    // Contact, requirement and the engagement history the example calls for.
    await expect(detail).toContainText("9876500001");
    await expect(detail).toContainText("62.5 kVA silent diesel genset for cold storage");
    for (const tab of ["Overview", "History"]) {
      await expect(page.getByRole("button", { name: tab, exact: true })).toBeVisible();
    }
  });

  test("a quotation is built from the catalog and downloads as a PDF", async ({ page }) => {
    const media = (
      await (
        await ctx.post(`${API}/media`, {
          multipart: { file: { name: `${RUN_TAG}-p.png`, mimeType: "image/png", buffer: PNG } },
        })
      ).json()
    ).data;
    track("media", media.id);
    const product = (
      await (
        await ctx.post(`${API}/products`, {
          data: {
            name: `${RUN_TAG} 40 kVA Silent`,
            kva: 40,
            price: 480000,
            longDescription: `${RUN_TAG} 40 kVA silent diesel generating set with acoustic canopy`,
            imageIds: [media.id],
            specs: [{ label: "Engine", value: "Mahindra" }],
          },
        })
      ).json()
    ).data;
    track("products", product.id);

    await page.goto("/quotations");
    await waitForTable(page);
    await page.getByRole("button", { name: /New Quotation/ }).click();
    await page.locator("input[name='customerName']").fill(`${RUN_TAG} PdfCustomer`);
    await page.getByTestId("product-picker-0").click();
    await page.getByPlaceholder("Search the catalog...").fill(`${RUN_TAG} 40`);
    await page.getByTestId(`product-option-${product.id}`).click();

    // Picking from the catalog fills description, rate and GST in one go.
    await expect(page.locator("#item-description-0")).toHaveValue(/40 kVA silent/);
    await expect(page.locator("input[name='items.0.unitPrice']")).toHaveValue("480000");
    await page.getByRole("button", { name: "Create", exact: true }).click();

    // The document exists and renders as a real PDF.
    await expect(page.getByText(`${RUN_TAG} PdfCustomer`).first()).toBeVisible();
    const listed = await ctx.get(`${API}/quotations?search=${RUN_TAG} PdfCustomer&limit=5`);
    const doc = ((await listed.json()).data as Array<{ id: string }>)[0];
    expect(doc).toBeTruthy();
    track("quotations", doc.id);

    const pdf = await ctx.get(`${API}/quotations/${doc.id}/pdf`);
    expect(pdf.ok()).toBeTruthy();
    const body = await pdf.body();
    expect(body.subarray(0, 5).toString()).toBe("%PDF-");
    // The catalog image is embedded, which is what example 5's PDF shows.
    expect(body.toString("latin1")).toContain("/Image");
  });
});

test.describe("Example 6 — a way to add an image", () => {
  test("an image uploads and can be attached to a catalog product", async ({ page }) => {
    // The library is reached through the picker wherever an image is wanted.
    await page.goto("/templates");
    await expect(page.getByTestId("templates-page")).toBeVisible();
    await page.getByTestId("template-tab-whatsapp").click();
    await page.getByTestId("new-template").click();
    await page.getByTestId("pick-template-image").click();
    await expect(page.getByTestId("media-picker")).toBeVisible();
    await expect(page.getByText("Upload from Computer")).toBeVisible();
    await expect(page.getByTestId("media-file-input")).toHaveCount(1);

    const media = (
      await (
        await ctx.post(`${API}/media`, {
          multipart: {
            file: { name: `${RUN_TAG}-attach.png`, mimeType: "image/png", buffer: PNG },
          },
        })
      ).json()
    ).data;
    track("media", media.id);
    expect(media.url, "the upload has a fetchable URL").toBeTruthy();

    const product = (
      await (
        await ctx.post(`${API}/products`, {
          data: { name: `${RUN_TAG} Imaged`, imageIds: [media.id] },
        })
      ).json()
    ).data;
    track("products", product.id);
    expect(product.primaryImageUrl).toBe(media.url);
  });
});
