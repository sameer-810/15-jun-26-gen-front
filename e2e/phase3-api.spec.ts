import { test, expect, type APIRequestContext } from "@playwright/test";
import { API, RUN_TAG, adminApi, sweepRunFixtures } from "./helpers";

/**
 * Change Request Phase 3 — API contract.
 *
 * Point 10 — Tax Invoice as a third document type, with its own FY-based
 *            numbering series and a PI → Invoice conversion
 * Point 6  — Bill To / Ship To split, HSN summary, and "auto fetch" of a
 *            customer's last billing/shipping block
 * Point 16 — the line item carries the catalog image and spec block
 *
 * Plus the immutability rules a statutory GST invoice needs.
 */

let ctx: APIRequestContext;
const docIds: string[] = [];

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** Build a document and remember it for cleanup. */
async function createDoc(overrides: Record<string, unknown> = {}) {
  const res = await ctx.post(`${API}/quotations`, {
    data: {
      docType: "proforma",
      customerName: `${RUN_TAG} Acme Cold Storage`,
      customerMobile: "9768412305",
      customerAddress: "Plot 14, Peenya, Bengaluru 560058",
      customerGstin: "29ABCDE1234F1Z5",
      customerState: "Karnataka",
      isInterState: false,
      items: [
        {
          description: "125 kVA Silent Diesel Generator Set",
          model: "MR2500E",
          kva: 125,
          hsnCode: "84079090",
          quantity: 2,
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

test.beforeAll(async () => {
  ({ ctx } = await adminApi());
});

test.afterAll(async () => {
  for (const id of docIds) await ctx.delete(`${API}/quotations/${id}`).catch(() => undefined);
  await sweepRunFixtures(ctx);
  await ctx.dispose();
});

test.describe("Point 10 — Tax Invoice as a third document type", () => {
  test("an invoice is numbered per financial year, gaplessly", async () => {
    const a = await createDoc({ docType: "invoice" });
    const b = await createDoc({ docType: "invoice" });

    // INV/2026-27/0001 shape
    expect(a.docNumberFormatted).toMatch(/^[A-Z]+\/\d{4}-\d{2}\/\d{4}$/);
    expect(a.financialYear).toMatch(/^\d{4}-\d{2}$/);
    expect(b.financialYear).toBe(a.financialYear);
    // Sequential with no gap.
    expect(b.docNumber).toBe(a.docNumber + 1);
    expect(b.docNumberFormatted).toBe(
      a.docNumberFormatted.replace(/\d{4}$/, String(b.docNumber).padStart(4, "0")),
    );
  });

  test("quotations and proformas keep their own separate series", async () => {
    const q = await createDoc({ docType: "quotation" });
    const p = await createDoc({ docType: "proforma" });
    expect(q.docNumberFormatted).toMatch(/^QTN-\d+$/);
    expect(p.docNumberFormatted).toMatch(/^PI-\d+$/);
    expect(q.financialYear).toBeFalsy();
  });

  test("a proforma converts into a tax invoice, carrying everything over", async () => {
    const pi = await createDoc({
      shipToSameAsBilling: false,
      shipToName: `${RUN_TAG} Unit 2`,
      shipToAddress: "Hoskote Industrial Belt",
      shipToContactPerson: "Sharik",
      shipToMobile: "8657352130",
    });

    const res = await ctx.post(`${API}/quotations/${pi.id}/convert`, {
      data: { targetType: "invoice" },
    });
    expect(res.status(), await res.text()).toBe(201);
    const inv = (await res.json()).data;
    docIds.push(inv.id);

    expect(inv.docType).toBe("invoice");
    expect(inv.sourceDocId).toBe(pi.id);
    expect(inv.grandTotal).toBe(pi.grandTotal);
    expect(inv.items).toHaveLength(pi.items.length);
    // The ship-to block survives the conversion — a false boolean is easy to
    // lose in a copy, and it changes what the PDF prints.
    expect(inv.shipToSameAsBilling).toBe(false);
    expect(inv.shipToName).toBe(`${RUN_TAG} Unit 2`);
    expect(inv.shipToContactPerson).toBe("Sharik");
  });

  test("converting to the same type is refused", async () => {
    const pi = await createDoc();
    const res = await ctx.post(`${API}/quotations/${pi.id}/convert`, {
      data: { targetType: "proforma" },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error.code).toBe("SAME_DOC_TYPE");
  });
});

test.describe("An issued tax invoice is immutable", () => {
  test("issue locks it against edits and deletion", async () => {
    const inv = await createDoc({ docType: "invoice" });
    expect(inv.isIssued).toBe(false);

    // Editable while still a draft.
    const draftEdit = await ctx.patch(`${API}/quotations/${inv.id}`, {
      data: { notes: "fine while draft" },
    });
    expect(draftEdit.ok()).toBeTruthy();

    const issued = await ctx.post(`${API}/quotations/${inv.id}/issue`);
    expect(issued.ok(), await issued.text()).toBeTruthy();
    const body = (await issued.json()).data;
    expect(body.isIssued).toBe(true);
    expect(body.issuedAt).toBeTruthy();
    // Issuing moves a draft on to "sent".
    expect(body.status).toBe("sent");

    for (const [label, res] of [
      ["edit", await ctx.patch(`${API}/quotations/${inv.id}`, { data: { notes: "tamper" } })],
      ["delete", await ctx.delete(`${API}/quotations/${inv.id}`)],
      ["re-issue", await ctx.post(`${API}/quotations/${inv.id}/issue`)],
    ] as const) {
      expect(res.status(), `${label} should be rejected`).toBe(409);
      expect((await res.json()).error.code).toBe("DOCUMENT_ISSUED");
    }

    // The note from before issuing is still the stored one.
    const after = await ctx.get(`${API}/quotations/${inv.id}`);
    expect((await after.json()).data.notes).toBe("fine while draft");
  });

  test("only a tax invoice can be issued", async () => {
    const q = await createDoc({ docType: "quotation" });
    const res = await ctx.post(`${API}/quotations/${q.id}/issue`);
    expect(res.status()).toBe(400);
    expect((await res.json()).error.code).toBe("NOT_AN_INVOICE");
  });

  test("a sales executive cannot issue", async () => {
    const login = await ctx.post(`${API}/auth/login`, {
      data: { email: "sales@srfpowermachine.com", password: "Sales@123" },
    });
    test.skip(!login.ok(), "no seeded sales user in this database");
    const salesToken = (await login.json()).data.accessToken;

    const inv = await createDoc({ docType: "invoice" });
    const res = await ctx.post(`${API}/quotations/${inv.id}/issue`, {
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    expect(res.status()).toBe(403);
  });
});

test.describe("A partial update must not rewrite untouched fields", () => {
  test("PATCHing one field leaves the defaulted ones alone", async () => {
    // Zod's .partial() keeps .default(), so a PATCH of {notes} used to also
    // send isInterState:false, status:"draft" and shipToSameAsBilling:true —
    // silently flipping an IGST document and un-sending a sent one.
    const doc = await createDoc({
      isInterState: true,
      shipToSameAsBilling: false,
      shipToName: `${RUN_TAG} Warehouse`,
    });
    expect(doc.isInterState).toBe(true);

    await ctx.patch(`${API}/quotations/${doc.id}/status`, { data: { status: "accepted" } });
    const patched = await ctx.patch(`${API}/quotations/${doc.id}`, {
      data: { notes: "just a note" },
    });
    expect(patched.ok()).toBeTruthy();

    const after = (await (await ctx.get(`${API}/quotations/${doc.id}`)).json()).data;
    expect(after.notes).toBe("just a note");
    expect(after.isInterState, "isInterState was reset by the PATCH").toBe(true);
    expect(after.status, "status was reset by the PATCH").toBe("accepted");
    expect(after.shipToSameAsBilling, "ship-to flag was reset by the PATCH").toBe(false);
    expect(after.shipToName).toBe(`${RUN_TAG} Warehouse`);
  });

  test("the same holds for a lead", async () => {
    const created = await ctx.post(`${API}/leads`, {
      data: {
        customerName: `${RUN_TAG} Partial Lead`,
        status: "negotiation",
        estimatedValue: 250000,
        source: "indiamart",
        quantity: 5,
      },
    });
    expect(created.status()).toBe(201);
    const lead = (await created.json()).data;

    try {
      await ctx.patch(`${API}/leads/${lead.id}`, { data: { city: "Pune" } });
      const after = (await (await ctx.get(`${API}/leads/${lead.id}`)).json()).data;
      expect(after.city).toBe("Pune");
      expect(after.status, "lead status was reset by the PATCH").toBe("negotiation");
      expect(after.estimatedValue, "estimated value was zeroed by the PATCH").toBe(250000);
      expect(after.source).toBe("indiamart");
      expect(after.quantity).toBe(5);
    } finally {
      await ctx.delete(`${API}/leads/${lead.id}`).catch(() => undefined);
    }
  });
});

test.describe("Point 6 — HSN summary and auto-fetch", () => {
  test("the HSN summary groups by code and reconciles with the document tax", async () => {
    const doc = await createDoc({
      items: [
        { description: "Genset", hsnCode: "84079090", quantity: 2, unitPrice: 950000, taxRate: 18 },
        {
          description: "Alternator",
          hsnCode: "85016100",
          quantity: 2,
          unitPrice: 450000,
          taxRate: 18,
        },
        { description: "Parts", hsnCode: "84079090", quantity: 1, unitPrice: 100000, taxRate: 18 },
      ],
    });

    // Two distinct HSN codes, with the repeated one merged.
    expect(doc.hsnSummary).toHaveLength(2);
    const genset = doc.hsnSummary.find((h: { hsnCode: string }) => h.hsnCode === "84079090");
    expect(genset.taxableValue).toBe(2_000_000); // 1,900,000 + 100,000
    expect(genset.quantity).toBe(3);

    // The per-HSN tax must add up to the document totals, or GSTR-1 won't file.
    const sumCgst = doc.hsnSummary.reduce((s: number, h: { cgst: number }) => s + h.cgst, 0);
    const sumSgst = doc.hsnSummary.reduce((s: number, h: { sgst: number }) => s + h.sgst, 0);
    const sumTaxable = doc.hsnSummary.reduce(
      (s: number, h: { taxableValue: number }) => s + h.taxableValue,
      0,
    );
    expect(Math.round(sumCgst * 100) / 100).toBe(doc.cgst);
    expect(Math.round(sumSgst * 100) / 100).toBe(doc.sgst);
    expect(Math.round(sumTaxable * 100) / 100).toBe(doc.taxableValue);
  });

  test("IGST documents put the whole tax in the igst column", async () => {
    const doc = await createDoc({ isInterState: true });
    expect(doc.cgst).toBe(0);
    expect(doc.sgst).toBe(0);
    expect(doc.igst).toBe(doc.totalTax);
    const sumIgst = doc.hsnSummary.reduce((s: number, h: { igst: number }) => s + h.igst, 0);
    expect(Math.round(sumIgst * 100) / 100).toBe(doc.igst);
  });

  test("auto-fetch returns the last billing and shipping block for a mobile", async () => {
    await createDoc({
      customerMobile: "9812345670",
      shipToSameAsBilling: false,
      shipToName: `${RUN_TAG} Depot`,
      shipToAddress: "Warehouse Road",
    });

    // Formatted the way a user would type it — the lookup normalises digits.
    const res = await ctx.get(
      `${API}/quotations/customer-lookup?mobile=${encodeURIComponent("+91 98123 45670")}`,
    );
    expect(res.ok()).toBeTruthy();
    const found = (await res.json()).data;
    expect(found).toBeTruthy();
    expect(found.customerGstin).toBe("29ABCDE1234F1Z5");
    expect(found.shipToSameAsBilling).toBe(false);
    expect(found.shipToName).toBe(`${RUN_TAG} Depot`);
  });

  test("auto-fetch returns null for an unknown customer", async () => {
    const res = await ctx.get(`${API}/quotations/customer-lookup?mobile=0000000000`);
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).data).toBeNull();
  });
});

test.describe("Point 16 — the PDF carries images, specs and the HSN table", () => {
  test("a tax invoice PDF renders with every required section", async () => {
    // Upload an image so the line item has one to embed.
    const up = await ctx.post(`${API}/media`, {
      multipart: { file: { name: `${RUN_TAG}-pdf.png`, mimeType: "image/png", buffer: PNG } },
    });
    expect(up.status()).toBe(201);
    const media = (await up.json()).data;

    const doc = await createDoc({
      docType: "invoice",
      shipToSameAsBilling: false,
      shipToName: `${RUN_TAG} Delivery Site`,
      shipToAddress: "Hoskote Industrial Belt, Bengaluru Rural",
      shipToContactPerson: "Sharik",
      items: [
        {
          description: "125 kVA Silent Diesel Generator Set",
          model: "MR2500E",
          kva: 125,
          hsnCode: "84079090",
          quantity: 2,
          unitPrice: 950000,
          taxRate: 18,
          unit: "Piece",
          imageUrl: media.url,
          specs: [
            { label: "Power", value: "125 kVA" },
            { label: "Cooling System", value: "Water Cooling" },
          ],
        },
      ],
    });

    const res = await ctx.get(`${API}/quotations/${doc.id}/pdf`);
    expect(res.ok(), await res.text()).toBeTruthy();
    expect(res.headers()["content-type"]).toContain("application/pdf");
    // The slash in INV/2026-27/0001 is illegal in a filename.
    expect(res.headers()["content-disposition"]).not.toMatch(/filename="[^"]*\//);

    const body = await res.body();
    expect(body.length).toBeGreaterThan(2000);
    expect(body.subarray(0, 5).toString()).toBe("%PDF-");

    await ctx.delete(`${API}/media/${media.id}`).catch(() => undefined);
  });

  test("a PDF still renders when a line-item image is unreachable", async () => {
    // A dead image URL must degrade to a text-only row, never fail the document.
    const doc = await createDoc({
      items: [
        {
          description: "Genset with a broken image",
          hsnCode: "84079090",
          quantity: 1,
          unitPrice: 100000,
          taxRate: 18,
          imageUrl: "http://127.0.0.1:9/does-not-exist.png",
        },
      ],
    });
    const res = await ctx.get(`${API}/quotations/${doc.id}/pdf`);
    expect(res.ok()).toBeTruthy();
    expect((await res.body()).subarray(0, 5).toString()).toBe("%PDF-");
  });
});
