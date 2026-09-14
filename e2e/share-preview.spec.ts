import { test, expect, type APIRequestContext } from "@playwright/test";
import { API, RUN_TAG, adminApi, sweepRunFixtures } from "./helpers";

/**
 * The WhatsApp preview card.
 *
 * When a document link is pasted into a chat, WhatsApp fetches the URL itself
 * and builds the card from the Open Graph tags it finds. It reads HTML only — a
 * link answering with a PDF can produce nothing but a bare grey card, which is
 * why the generator picture never appeared.
 *
 * A fault here is invisible from inside the CRM: everything looks right to the
 * salesperson, and only the customer sees the empty card. So this checks the
 * page exactly as the crawler sees it, including the parts easy to get wrong —
 * the picture must actually be fetchable, and small enough that WhatsApp does
 * not give up on it.
 */

/** WhatsApp identifies itself; the page must not depend on JavaScript for it. */
const CRAWLER_UA = "WhatsApp/2.23.20.0 A";

/** Above roughly 600 KB WhatsApp abandons the image and shows a text-only card. */
const IMAGE_BUDGET_BYTES = 600 * 1024;

const ORIGIN = API.replace(/\/api$/, "");

let ctx: APIRequestContext;
const cleanup: { path: string; id: string }[] = [];

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

/**
 * A quotation to share. `imageUrl` is optional so both paths are covered: the
 * product photo, and the fallback for a document with no picture at all.
 */
async function quotationWithImage(imageUrl?: string) {
  const res = await ctx.post(`${API}/quotations`, {
    data: {
      docType: "quotation",
      customerName: `${RUN_TAG} Raj Traders`,
      customerMobile: "9900112233",
      items: [
        {
          description: "Bajaj M model 3900PS single phase self start generator",
          model: "3900PS",
          kva: 3.9,
          quantity: 1,
          unitPrice: 35000,
          taxRate: 18,
          ...(imageUrl ? { imageUrl } : {}),
        },
      ],
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  const doc = (await res.json()).data;
  cleanup.push({ path: "quotations", id: doc.id });
  return doc;
}

/** The shareable link, pointed at the server under test rather than production. */
async function shareLink(id: string) {
  const res = await ctx.get(`${API}/messages/document-link/${id}`);
  expect(res.status(), await res.text()).toBe(200);
  const url: string = (await res.json()).data.url;
  // PUBLIC_BASE_URL names the deployed API; the link is otherwise identical.
  return url.replace(/^https?:\/\/[^/]+/, ORIGIN);
}

/** Read one og:/twitter: tag out of the markup the way a crawler would. */
function metaTag(html: string, prop: string) {
  return html.match(new RegExp(`<meta (?:property|name)="${prop}" content="([^"]*)"`))?.[1] ?? null;
}

/** A real image in the business's own Cloudinary account, so the fetch below is genuine. */
const CLOUDINARY_IMAGE =
  "https://res.cloudinary.com/g7pdjlqb/image/upload/v1789232527/srf-crm/media/srf-share-card.jpg";

test.describe("the link a customer receives", () => {
  test("answers with HTML, not the PDF, so a card can be built at all", async ({ request }) => {
    const doc = await quotationWithImage();
    const res = await request.get(await shareLink(doc.id), {
      headers: { "User-Agent": CRAWLER_UA },
    });

    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/html");
  });

  test("keeps the PDF itself one tap behind the page", async ({ request }) => {
    const doc = await quotationWithImage();
    const link = await shareLink(doc.id);

    const html = await (await request.get(link, { headers: { "User-Agent": CRAWLER_UA } })).text();
    // The page builds an absolute href from PUBLIC_BASE_URL, which names the
    // deployed API rather than the host under test — so match on the path.
    expect(html).toContain(`${new URL(link).pathname}/pdf"`);

    const pdf = await request.get(`${link}/pdf`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
  });

  test("names the document and its total on the card", async ({ request }) => {
    const doc = await quotationWithImage();
    const html = await (
      await request.get(await shareLink(doc.id), { headers: { "User-Agent": CRAWLER_UA } })
    ).text();

    expect(metaTag(html, "og:title")).toContain(doc.docNumberFormatted);
    expect(metaTag(html, "og:description")).toContain("3900PS");
    expect(metaTag(html, "og:url")).toBeTruthy();
  });

  test("is not indexable — these are private customer documents", async ({ request }) => {
    const doc = await quotationWithImage();
    const res = await request.get(await shareLink(doc.id), {
      headers: { "User-Agent": CRAWLER_UA },
    });

    expect(res.headers()["x-robots-tag"]).toContain("noindex");
    expect(await res.text()).toContain('name="robots"');
  });

  test("refuses a tampered token", async ({ request }) => {
    const doc = await quotationWithImage();
    const link = await shareLink(doc.id);
    const res = await request.get(`${link.slice(0, -4)}XXXX`);
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe("the picture on the card", () => {
  test("is the product photo, sized to the shape WhatsApp crops to", async ({ request }) => {
    const doc = await quotationWithImage(CLOUDINARY_IMAGE);
    const html = await (
      await request.get(await shareLink(doc.id), { headers: { "User-Agent": CRAWLER_UA } })
    ).text();

    const image = metaTag(html, "og:image");
    expect(image).toContain("c_pad,b_white,w_1200,h_630");
    expect(image).toMatch(/^https:/); // WhatsApp ignores a plain-http image
    expect(metaTag(html, "og:image:width")).toBe("1200");
    expect(metaTag(html, "og:image:height")).toBe("630");
    expect(metaTag(html, "twitter:card")).toBe("summary_large_image");
  });

  test("is actually fetchable, and small enough that WhatsApp waits for it", async ({
    request,
  }) => {
    const doc = await quotationWithImage(CLOUDINARY_IMAGE);
    const html = await (
      await request.get(await shareLink(doc.id), { headers: { "User-Agent": CRAWLER_UA } })
    ).text();

    const res = await request.get(metaTag(html, "og:image")!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image");
    expect((await res.body()).length).toBeLessThan(IMAGE_BUDGET_BYTES);
  });

  test("falls back to the business picture when the document has no photo", async ({ request }) => {
    const profile = await (await ctx.get(`${API}/business-profile`)).json();
    const fallback = profile.data?.shareImageUrl || profile.data?.letterheadHeaderUrl;
    test.skip(!fallback, "no share picture set on the business profile");

    const doc = await quotationWithImage();
    const html = await (
      await request.get(await shareLink(doc.id), { headers: { "User-Agent": CRAWLER_UA } })
    ).text();

    expect(metaTag(html, "og:image")).toBeTruthy();
  });
});

test.describe("the page the customer lands on", () => {
  test("shows the picture — the app-wide image policy must not block it", async ({ page }) => {
    const doc = await quotationWithImage(CLOUDINARY_IMAGE);
    await page.goto(await shareLink(doc.id));

    const hero = page.locator("img.hero");
    await expect(hero).toBeVisible();
    // A blocked or broken image still "exists"; only naturalWidth proves it drew.
    expect(await hero.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  });

  test("fits a phone screen, which is where the link is opened", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const doc = await quotationWithImage(CLOUDINARY_IMAGE);
    await page.goto(await shareLink(doc.id));

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflows, "the page scrolls sideways on a phone").toBe(false);
    await expect(page.getByRole("link", { name: /view the full/i })).toBeVisible();
  });

  test("does not let a long description swamp the card", async ({ page }) => {
    const res = await ctx.post(`${API}/quotations`, {
      data: {
        docType: "quotation",
        customerName: `${RUN_TAG} Long Text`,
        customerMobile: "9900112233",
        items: [
          {
            description: `${"Heavy duty industrial silent diesel generating set with canopy. ".repeat(8)}`,
            model: "LONG",
            kva: 25,
            quantity: 1,
            unitPrice: 100000,
            taxRate: 18,
          },
        ],
      },
    });
    const doc = (await res.json()).data;
    cleanup.push({ path: "quotations", id: doc.id });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(await shareLink(doc.id));

    const cell = await page.locator("tbody td").first().innerText();
    expect(cell.length).toBeLessThan(80);
    expect(cell).toContain("…");
  });
});

/**
 * A template's picture, sent without a document.
 *
 * Without the WhatsApp Business API a message leaves through a `wa.me` link,
 * which carries text and nothing else, so the picture a salesperson saw in the
 * composer never reached the customer. The message now ends with a link whose
 * page names the picture as og:image, and WhatsApp draws it as the preview card.
 */

// A 1x1 PNG is enough: the assertions are about the link, the tags, and that
// Cloudinary really serves what the tags name.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("a template's picture, with no document attached", () => {
  let apiConnected = false;
  let pictureTemplateId = "";
  let plainTemplateId = "";

  test.beforeAll(async () => {
    const caps = await (await ctx.get(`${API}/messages/capabilities`)).json();
    apiConnected = Boolean(caps.data?.whatsapp?.configured);

    const up = await ctx.post(`${API}/media`, {
      multipart: { file: { name: `${RUN_TAG}-card.png`, mimeType: "image/png", buffer: PNG } },
    });
    expect(up.status(), await up.text()).toBe(201);
    const media = (await up.json()).data;
    cleanup.push({ path: "media", id: media.id });

    const withPicture = await ctx.post(`${API}/templates`, {
      data: {
        kind: "whatsapp",
        name: `${RUN_TAG} Picture card`,
        // Laid out like the real templates: no line breaks, only runs of spaces
        // pushing each ✓ point onto its own line inside a chat bubble.
        body: "✓*Bajaj 3900PS* generator                              ✓Two years warranty",
        imageId: media.id,
      },
    });
    expect(withPicture.status(), await withPicture.text()).toBe(201);
    const tpl = (await withPicture.json()).data;
    cleanup.push({ path: "templates", id: tpl.id });
    expect(tpl.imageUrl, "the picture must be online for WhatsApp to fetch it").toMatch(/^https:/);
    pictureTemplateId = tpl.id;

    const plain = await ctx.post(`${API}/templates`, {
      data: { kind: "whatsapp", name: `${RUN_TAG} No picture`, body: "Plain text only" },
    });
    expect(plain.status(), await plain.text()).toBe(201);
    plainTemplateId = (await plain.json()).data.id;
    cleanup.push({ path: "templates", id: plainTemplateId });
  });

  test.beforeEach(() => {
    // With the Business API connected the picture goes as a real image instead.
    test.skip(apiConnected, "WhatsApp Business API is connected; no link is used");
  });

  /** Send, then read back the text the salesperson's WhatsApp opens with. */
  async function send(data: Record<string, unknown>) {
    const res = await ctx.post(`${API}/messages`, {
      data: { channel: "whatsapp", to: "9900112233", ...data },
    });
    expect(res.status(), await res.text()).toBe(201);
    const msg = (await res.json()).data;
    const text = new URL(msg.handoffUrl).searchParams.get("text") ?? "";
    return { msg, links: text.match(/https?:\/\/\S+/g) ?? [] };
  }

  /** The link, pointed at the server under test rather than the deployed one. */
  const local = (url: string) => url.replace(/^https?:\/\/[^/]+/, ORIGIN);

  test("reaches the customer as a preview card", async ({ request }) => {
    const { msg, links } = await send({ templateId: pictureTemplateId });

    expect(links, "exactly one link, so WhatsApp previews the right one").toHaveLength(1);
    expect(links[0]).toContain("/p/");
    expect(msg.previewUrl).toBe(links[0]);

    const res = await request.get(local(links[0]), { headers: { "User-Agent": CRAWLER_UA } });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/html");
    const html = await res.text();

    const image = metaTag(html, "og:image");
    expect(image).toContain("c_pad,b_white,w_1200,h_630");
    // WhatsApp's *bold* markers are stripped from the card's text.
    expect(metaTag(html, "og:description")).toBe("Bajaj 3900PS generator");
    expect(metaTag(html, "twitter:card")).toBe("summary_large_image");

    const img = await request.get(image!);
    expect(img.status()).toBe(200);
    expect(img.headers()["content-type"]).toContain("image");
  });

  test("gives way to an attached document, which has a card of its own", async () => {
    const doc = await quotationWithImage();
    const { msg, links } = await send({ templateId: pictureTemplateId, documentId: doc.id });

    expect(links).toHaveLength(1);
    expect(links[0]).toContain("/d/");
    expect(msg.previewUrl).toBeFalsy();
  });

  test("adds no link when the template has no picture", async () => {
    const { msg, links } = await send({ templateId: plainTemplateId });
    expect(links).toHaveLength(0);
    expect(msg.previewUrl).toBeFalsy();
  });

  test("cannot be swapped with a document link", async ({ request }) => {
    const { links } = await send({ templateId: pictureTemplateId });
    const previewToken = links[0].split("/p/")[1];
    const doc = await quotationWithImage();
    const documentToken = (await shareLink(doc.id)).split("/d/")[1];

    expect((await request.get(`${ORIGIN}/d/${previewToken}`)).status()).toBe(403);
    expect((await request.get(`${ORIGIN}/p/${documentToken}`)).status()).toBe(403);
  });

  test("shows the picture and the message on a phone", async ({ page }) => {
    const { links } = await send({ templateId: pictureTemplateId });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(local(links[0]));

    const hero = page.locator("img.hero");
    await expect(hero).toBeVisible();
    expect(await hero.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    // Each ✓ point on its own line, although the template has no line breaks.
    const lines = (await page.locator(".message").innerText())
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    expect(lines).toEqual(["✓Bajaj 3900PS generator", "✓Two years warranty"]);

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflows, "the page scrolls sideways on a phone").toBe(false);
  });
});
