import { test, expect, type APIRequestContext } from "@playwright/test";
import { API, RUN_TAG, adminApi, sweepRunFixtures } from "./helpers";

/**
 * Change Request Phase 2 — API contract.
 *
 * Point 17 — media library: upload, kind/category filtering, facets, delete
 * Point 5  — product catalog carries the full long description and spec block
 * Point 4  — /products/options returns the exact line-item auto-fill payload
 */

let ctx: APIRequestContext;
const mediaIds: string[] = [];
const productIds: string[] = [];

/** A 1×1 PNG — small enough to keep the suite fast, real enough to upload. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** The description sample the client supplied with change-request point 5. */
const SAMPLE_DESCRIPTION = `4 KVA Bajaj M Non- SILENT elite class portable Petrol Generator Set with latest technology, Air Cooled engine developing 7.5 BHP at 3000 RPM, complete with standard accessories, coupled to 4 Kva BAJAJ M Alternator rated at 220 volts,

4 Kva BAJAJ M Non Silent genset Basic price will be: 50,000/- only
Special discounted price will be: 45,000 /- only
First filling of oil : complimentary.
With complete warranty package of 2 years against all manufacturing defects.

SPECIAL FEATURES :
1) Self start
2) Key switch`;

async function uploadPng(name: string, categories?: string) {
  const res = await ctx.post(`${API}/media`, {
    multipart: {
      file: { name, mimeType: "image/png", buffer: PNG },
      ...(categories ? { categories } : {}),
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  const media = (await res.json()).data;
  mediaIds.push(media.id);
  return media;
}

test.beforeAll(async () => {
  ({ ctx } = await adminApi());
});

test.afterAll(async () => {
  for (const id of productIds) await ctx.delete(`${API}/products/${id}`).catch(() => undefined);
  for (const id of mediaIds) await ctx.delete(`${API}/media/${id}`).catch(() => undefined);
  // Backstop for anything a mid-test failure left behind.
  await sweepRunFixtures(ctx);
  await ctx.dispose();
});

test.describe("Point 17 — media library", () => {
  test("uploads a file and returns a resolvable URL", async () => {
    const media = await uploadPng(`${RUN_TAG}-photo.png`, `${RUN_TAG}cat, Portable Generator`);

    expect(media.kind).toBe("image");
    expect(media.filename).toBe(`${RUN_TAG}-photo.png`);
    expect(media.sizeBytes).toBeGreaterThan(0);
    expect(media.url).toMatch(/^https?:\/\//);
    // Tags are normalised to lower case so filtering is predictable.
    expect(media.categories).toContain("portable generator");
    expect(media.categories).toContain(`${RUN_TAG.toLowerCase()}cat`);

    // The stored file is actually fetchable at the URL we handed back.
    const fetched = await ctx.get(media.url);
    expect(fetched.ok(), `stored file not reachable at ${media.url}`).toBeTruthy();
    expect(fetched.headers()["content-type"]).toContain("image");
  });

  test("rejects a disallowed file type", async () => {
    const res = await ctx.post(`${API}/media`, {
      multipart: {
        file: {
          name: "payload.html",
          mimeType: "text/html",
          buffer: Buffer.from("<script>alert(1)</script>"),
        },
      },
    });
    expect(res.status()).toBe(415);
    expect((await res.json()).error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });

  test("rejects a request with no file", async () => {
    const res = await ctx.post(`${API}/media`, { multipart: { caption: "nothing here" } });
    expect(res.status()).toBe(400);
    expect((await res.json()).error.code).toBe("NO_FILE");
  });

  test("filters by category and by kind", async () => {
    const tagged = await uploadPng(`${RUN_TAG}-tagged.png`, `${RUN_TAG}only`);
    const untagged = await uploadPng(`${RUN_TAG}-untagged.png`);

    const byCat = await ctx.get(`${API}/media?category=${RUN_TAG.toLowerCase()}only&limit=50`);
    const catIds = ((await byCat.json()).data as Array<{ id: string }>).map((m) => m.id);
    expect(catIds).toContain(tagged.id);
    expect(catIds).not.toContain(untagged.id);

    const byKind = await ctx.get(`${API}/media?kind=pdf&limit=50`);
    const kindItems = (await byKind.json()).data as Array<{ kind: string }>;
    expect(kindItems.every((m) => m.kind === "pdf")).toBe(true);
  });

  test("facets report category and kind counts plus the storage provider", async () => {
    await uploadPng(`${RUN_TAG}-facet.png`, `${RUN_TAG}facet`);
    const res = await ctx.get(`${API}/media/facets`);
    expect(res.ok()).toBeTruthy();
    const facets = (await res.json()).data;

    const cat = facets.categories.find(
      (c: { category: string }) => c.category === `${RUN_TAG.toLowerCase()}facet`,
    );
    expect(cat?.count).toBeGreaterThanOrEqual(1);
    expect(facets.kinds.some((k: { kind: string }) => k.kind === "image")).toBe(true);
    expect(["cloudinary", "local"]).toContain(facets.provider);
    expect(facets.maxUploadMb).toBeGreaterThan(0);
  });

  test("delete removes it from the library", async () => {
    const media = await uploadPng(`${RUN_TAG}-doomed.png`);
    const del = await ctx.delete(`${API}/media/${media.id}`);
    expect(del.ok()).toBeTruthy();
    expect((await ctx.get(`${API}/media/${media.id}`)).status()).toBe(404);
  });

  test("only admins may delete", async () => {
    const login = await ctx.post(`${API}/auth/login`, {
      data: { email: "sales@srfpowermachine.com", password: "Sales@123" },
    });
    test.skip(!login.ok(), "no seeded sales user in this database");
    const salesToken = (await login.json()).data.accessToken;

    const media = await uploadPng(`${RUN_TAG}-protected.png`);
    const res = await ctx.delete(`${API}/media/${media.id}`, {
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    expect(res.status()).toBe(403);
    // ...and it is still there.
    expect((await ctx.get(`${API}/media/${media.id}`)).status()).toBe(200);
  });
});

test.describe("Point 5 — catalog carries the full description and specs", () => {
  test("a long multi-line description round-trips unchanged", async () => {
    const res = await ctx.post(`${API}/products`, {
      data: {
        name: `${RUN_TAG} 4 Kva BAJAJ M Non Silent Portable Generator Set`,
        brand: "Bajaj",
        modelCode: `${RUN_TAG}-BM4000`,
        kva: 4,
        fuelType: "petrol",
        phase: "single",
        price: 45000,
        taxRate: 18,
        unit: "Piece",
        longDescription: SAMPLE_DESCRIPTION,
        specs: [
          { label: "Power", value: "4 kVA" },
          { label: "Condition", value: "New" },
          { label: "Cooling System", value: "Air Cooled" },
        ],
        categories: "Portable Generator, Petrol Generator",
      },
    });
    expect(res.status(), await res.text()).toBe(201);
    const product = (await res.json()).data;
    productIds.push(product.id);

    // Byte-for-byte, including the blank lines and the numbered feature list.
    expect(product.longDescription).toBe(SAMPLE_DESCRIPTION);
    expect(product.longDescription.split("\n").length).toBeGreaterThan(8);
    expect(product.specs).toHaveLength(3);
    expect(product.specs[2]).toEqual({ label: "Cooling System", value: "Air Cooled" });
    expect(product.categories).toEqual(["portable generator", "petrol generator"]);
  });

  test("images attach and the primary image URL is derived", async () => {
    const media = await uploadPng(`${RUN_TAG}-product.png`);
    const res = await ctx.post(`${API}/products`, {
      data: {
        name: `${RUN_TAG} With Image`,
        price: 170000,
        imageIds: [media.id],
      },
    });
    expect(res.status(), await res.text()).toBe(201);
    const product = (await res.json()).data;
    productIds.push(product.id);

    expect(product.images).toHaveLength(1);
    expect(product.images[0].id).toBe(media.id);
    expect(product.primaryImageUrl).toBe(media.url);
  });

  test("rejects a product with no name", async () => {
    const res = await ctx.post(`${API}/products`, { data: { price: 100 } });
    expect(res.status()).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });
});

test.describe("Point 4 — auto-fill payload for a quotation line item", () => {
  test("/products/options returns everything a line item needs", async () => {
    const create = await ctx.post(`${API}/products`, {
      data: {
        name: `${RUN_TAG} Autofill Genset`,
        modelCode: `${RUN_TAG}-AF1`,
        kva: 15,
        price: 170000,
        taxRate: 12,
        hsnCode: "8502",
        longDescription: SAMPLE_DESCRIPTION,
      },
    });
    expect(create.status(), await create.text()).toBe(201);
    productIds.push((await create.json()).data.id);

    const res = await ctx.get(`${API}/products/options?search=${RUN_TAG}`);
    expect(res.ok()).toBeTruthy();
    const options = (await res.json()).data as Array<{
      name: string;
      quotationDefaults: Record<string, unknown>;
    }>;

    const hit = options.find((o) => o.name === `${RUN_TAG} Autofill Genset`);
    expect(hit, "product missing from the options search").toBeTruthy();

    // This object is dropped straight into a line item by the picker.
    expect(hit!.quotationDefaults).toEqual({
      description: SAMPLE_DESCRIPTION,
      model: `${RUN_TAG}-AF1`,
      kva: 15,
      hsnCode: "8502",
      unitPrice: 170000,
      taxRate: 12,
    });
  });

  test("options search matches on model code as well as name", async () => {
    const res = await ctx.get(`${API}/products/options?search=${RUN_TAG}-AF1`);
    expect(res.ok()).toBeTruthy();
    const options = (await res.json()).data as Array<{ modelCode: string }>;
    expect(options.length).toBeGreaterThan(0);
    expect(options[0].modelCode).toBe(`${RUN_TAG}-AF1`);
  });

  test("inactive products are hidden from the picker", async () => {
    const create = await ctx.post(`${API}/products`, {
      data: { name: `${RUN_TAG} Retired Model`, price: 1, isActive: false },
    });
    expect(create.status()).toBe(201);
    const id = (await create.json()).data.id;
    productIds.push(id);

    const res = await ctx.get(`${API}/products/options?search=${RUN_TAG} Retired`);
    const options = (await res.json()).data as Array<{ id: string }>;
    expect(options.map((o) => o.id)).not.toContain(id);

    // ...but it is still in the full catalog list.
    const list = await ctx.get(`${API}/products?search=${RUN_TAG} Retired&limit=50`);
    const items = (await list.json()).data as Array<{ id: string }>;
    expect(items.map((p) => p.id)).toContain(id);
  });
});

test.describe("Catalog list, filters and Excel round-trip", () => {
  test("filters by category and fuel type", async () => {
    const res = await ctx.get(`${API}/products?category=petrol generator&limit=50`);
    expect(res.ok()).toBeTruthy();
    const items = (await res.json()).data as Array<{ categories: string[] }>;
    expect(items.every((p) => p.categories.includes("petrol generator"))).toBe(true);

    const byFuel = await ctx.get(`${API}/products?fuelType=petrol&limit=50`);
    const fuels = (await byFuel.json()).data as Array<{ fuelType: string }>;
    expect(fuels.every((p) => p.fuelType === "petrol")).toBe(true);
  });

  test("export produces a spreadsheet", async () => {
    const res = await ctx.get(`${API}/products/export`);
    expect(res.ok()).toBeTruthy();
    expect(res.headers()["content-type"]).toContain("spreadsheetml");
    expect((await res.body()).length).toBeGreaterThan(100);
  });

  test("import creates products, including the pipe-encoded spec block", async () => {
    const csv = [
      "Name,Brand,KVA,Price,GST %,Long Description,Specs,Categories",
      `"${RUN_TAG} Imported Genset",Mahindra,15,170000,18,"Imported line one","Power: 15 kVA | Condition: New","Imported Cat"`,
    ].join("\n");
    const base64 = Buffer.from(csv, "utf8").toString("base64");

    const res = await ctx.post(`${API}/products/import`, { data: { fileBase64: base64 } });
    expect(res.ok(), await res.text()).toBeTruthy();
    expect((await res.json()).data.created).toBe(1);

    const list = await ctx.get(`${API}/products?search=${RUN_TAG} Imported&limit=10`);
    const items = (await list.json()).data as Array<{
      id: string;
      specs: { label: string; value: string }[];
      categories: string[];
    }>;
    expect(items).toHaveLength(1);
    productIds.push(items[0].id);
    expect(items[0].specs).toEqual([
      { label: "Power", value: "15 kVA" },
      { label: "Condition", value: "New" },
    ]);
    expect(items[0].categories).toEqual(["imported cat"]);
  });
});
