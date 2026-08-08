import { test, expect, type APIRequestContext } from "@playwright/test";
import { API, RUN_TAG, adminApi, createLead, deleteLeads } from "./helpers";

/**
 * Change Request Phase 1 — API contract.
 *
 * Covers the server side of points 1 (email on the lead payload), 7 (status
 * vocabulary), 8 (received date/time), 9 (location + quantity fields, filters,
 * admin bulk delete).
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

test.describe("Point 7 — lead status vocabulary", () => {
  const NEW_STATUSES = [
    "important",
    "contacted",
    "follow_up",
    "quotation_sent",
    "negotiation",
    "deal_done",
    "irrelevant",
    "other",
  ];

  for (const status of NEW_STATUSES) {
    test(`accepts status "${status}"`, async () => {
      const lead = await createLead(ctx, { customerName: `${RUN_TAG} ${status}`, status });
      created.push(lead.id);
      const res = await ctx.get(`${API}/leads/${lead.id}`);
      expect(res.ok()).toBeTruthy();
      expect((await res.json()).data.status).toBe(status);
    });
  }

  test('rejects the retired "in_progress" status', async () => {
    const res = await ctx.post(`${API}/leads`, {
      data: { customerName: `${RUN_TAG} legacy`, status: "in_progress" },
    });
    // validateRequest maps a Zod failure to 400 VALIDATION_ERROR.
    expect(res.status()).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });

  test("no lead is left on the retired status after the migration", async () => {
    // The list endpoint now rejects in_progress as a filter value, which is
    // itself the proof the enum changed; the migration is verified by the
    // absence of any such lead in an unfiltered page.
    const res = await ctx.get(`${API}/leads?limit=200`);
    expect(res.ok()).toBeTruthy();
    const items = (await res.json()).data as Array<{ status: string }>;
    expect(items.some((l) => l.status === "in_progress")).toBe(false);
  });

  test("adding a follow-up moves a new lead to contacted, not in_progress", async () => {
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} followup`, status: "new" });
    created.push(lead.id);
    const res = await ctx.post(`${API}/leads/${lead.id}/follow-ups`, {
      data: { note: "Called the customer" },
    });
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).data.status).toBe("contacted");
  });
});

test.describe("Point 8 — lead carries a date and time", () => {
  test("createdAt is a full timestamp, not a bare date", async () => {
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} timestamp` });
    created.push(lead.id);
    const res = await ctx.get(`${API}/leads/${lead.id}`);
    const { createdAt } = (await res.json()).data;
    // ISO-8601 with a time component.
    expect(createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(Number.isNaN(Date.parse(createdAt))).toBe(false);
  });

  test("externalCreatedAt is exposed for imported leads", async () => {
    const res = await ctx.get(`${API}/leads?source=indiamart&limit=1`);
    expect(res.ok()).toBeTruthy();
    const items = (await res.json()).data as Array<Record<string, unknown>>;
    test.skip(items.length === 0, "no IndiaMART leads in this database");
    expect(items[0]).toHaveProperty("externalCreatedAt");
  });
});

test.describe("Point 9 — quantity and location", () => {
  test("lead quantity round-trips", async () => {
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} qty7`, quantity: 7 });
    created.push(lead.id);
    const res = await ctx.get(`${API}/leads/${lead.id}`);
    expect((await res.json()).data.quantity).toBe(7);
  });

  test("lead quantity filter bounds the result set", async () => {
    const small = await createLead(ctx, { customerName: `${RUN_TAG} qty2`, quantity: 2 });
    const big = await createLead(ctx, { customerName: `${RUN_TAG} qty50`, quantity: 50 });
    created.push(small.id, big.id);

    const res = await ctx.get(`${API}/leads?search=${RUN_TAG}&minQuantity=40&limit=100`);
    expect(res.ok()).toBeTruthy();
    const items = (await res.json()).data as Array<{ id: string; quantity: number }>;
    expect(items.map((l) => l.id)).toContain(big.id);
    expect(items.map((l) => l.id)).not.toContain(small.id);
    expect(items.every((l) => l.quantity >= 40)).toBe(true);
  });

  test("lead location filter matches on city, case-insensitively", async () => {
    const here = await createLead(ctx, {
      customerName: `${RUN_TAG} here`,
      city: `${RUN_TAG}CITY`,
    });
    const elsewhere = await createLead(ctx, {
      customerName: `${RUN_TAG} elsewhere`,
      city: "Nowhere",
    });
    created.push(here.id, elsewhere.id);

    const res = await ctx.get(`${API}/leads?location=${RUN_TAG.toLowerCase()}city&limit=100`);
    expect(res.ok()).toBeTruthy();
    const ids = ((await res.json()).data as Array<{ id: string }>).map((l) => l.id);
    expect(ids).toContain(here.id);
    expect(ids).not.toContain(elsewhere.id);
  });

  test("an empty quantity filter is ignored rather than treated as 0", async () => {
    const res = await ctx.get(`${API}/leads?minQuantity=&maxQuantity=&limit=5`);
    expect(res.ok()).toBeTruthy();
    expect(((await res.json()).data as unknown[]).length).toBeGreaterThan(0);
  });

  test("inventory accepts and filters by location", async () => {
    const loc = `${RUN_TAG}-YARD`;
    const create = await ctx.post(`${API}/inventory`, {
      data: {
        model: `${RUN_TAG}-GEN`,
        brand: "E2E",
        kva: 25,
        fuelType: "diesel",
        phase: "three",
        location: loc,
        availableQuantity: 4,
        sellingPrice: 250000,
      },
    });
    expect(create.status(), await create.text()).toBe(201);
    const invId = (await create.json()).data.id;

    try {
      const res = await ctx.get(`${API}/inventory?location=${encodeURIComponent(loc)}&limit=50`);
      expect(res.ok()).toBeTruthy();
      const items = (await res.json()).data as Array<{ id: string; location: string }>;
      expect(items.map((i) => i.id)).toContain(invId);
      expect(items.every((i) => i.location === loc)).toBe(true);

      // Quantity bounds apply to units on hand.
      const none = await ctx.get(
        `${API}/inventory?location=${encodeURIComponent(loc)}&minQuantity=99&limit=50`,
      );
      expect(((await none.json()).data as unknown[]).length).toBe(0);
    } finally {
      await ctx.delete(`${API}/inventory/${invId}`).catch(() => undefined);
    }
  });

  test("a sale inherits its location from the inventory item and is filterable", async () => {
    const loc = `${RUN_TAG}-DEPOT`;
    const create = await ctx.post(`${API}/inventory`, {
      data: {
        model: `${RUN_TAG}-SALEGEN`,
        kva: 15,
        fuelType: "diesel",
        phase: "three",
        location: loc,
        availableQuantity: 5,
        sellingPrice: 100000,
      },
    });
    expect(create.status(), await create.text()).toBe(201);
    const invId = (await create.json()).data.id;

    let saleId: string | undefined;
    try {
      const sale = await ctx.post(`${API}/sales`, {
        data: {
          inventoryId: invId,
          quantity: 2,
          unitPrice: 100000,
          customerName: `${RUN_TAG} Buyer`,
        },
      });
      expect(sale.status(), await sale.text()).toBe(201);
      const saleBody = (await sale.json()).data;
      saleId = saleBody.id;
      expect(saleBody.location).toBe(loc);

      const res = await ctx.get(`${API}/sales?location=${encodeURIComponent(loc)}&limit=50`);
      expect(res.ok()).toBeTruthy();
      const items = (await res.json()).data as Array<{ id: string }>;
      expect(items.map((s) => s.id)).toContain(saleId);

      // Quantity filter on sales.
      const qty = await ctx.get(
        `${API}/sales?location=${encodeURIComponent(loc)}&minQuantity=5&limit=50`,
      );
      expect(((await qty.json()).data as unknown[]).length).toBe(0);
    } finally {
      // Void the sale first so stock is restored, then remove the model.
      if (saleId) await ctx.delete(`${API}/sales/${saleId}`).catch(() => undefined);
      await ctx.delete(`${API}/inventory/${invId}`).catch(() => undefined);
    }
  });
});

test.describe("Point 9 — admin bulk delete of dead leads", () => {
  test("deletes Not Interested / Irrelevant and skips live leads", async () => {
    const dead1 = await createLead(ctx, {
      customerName: `${RUN_TAG} dead1`,
      status: "not_interested",
    });
    const dead2 = await createLead(ctx, {
      customerName: `${RUN_TAG} dead2`,
      status: "irrelevant",
    });
    const alive = await createLead(ctx, { customerName: `${RUN_TAG} alive`, status: "contacted" });
    created.push(alive.id);

    const res = await ctx.post(`${API}/leads/bulk-delete`, {
      data: { ids: [dead1.id, dead2.id, alive.id] },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    const body = await res.json();
    expect(body.data.deleted).toBe(2);
    expect(body.data.skipped).toBe(1);

    // The live lead survived...
    expect((await ctx.get(`${API}/leads/${alive.id}`)).status()).toBe(200);
    // ...and the dead ones are gone.
    expect((await ctx.get(`${API}/leads/${dead1.id}`)).status()).toBe(404);
    expect((await ctx.get(`${API}/leads/${dead2.id}`)).status()).toBe(404);
  });

  test("refuses a selection containing no dead leads", async () => {
    const alive = await createLead(ctx, { customerName: `${RUN_TAG} alive2`, status: "new" });
    created.push(alive.id);
    const res = await ctx.post(`${API}/leads/bulk-delete`, { data: { ids: [alive.id] } });
    expect(res.status()).toBe(400);
    // Distinct from a schema failure — the request was well-formed, the
    // selection just contained nothing deletable.
    expect((await res.json()).error.code).toBe("NO_DELETABLE_LEADS");
    expect((await ctx.get(`${API}/leads/${alive.id}`)).status()).toBe(200);
  });

  test("rejects an empty id list", async () => {
    const res = await ctx.post(`${API}/leads/bulk-delete`, { data: { ids: [] } });
    expect(res.status()).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });

  test("is closed to non-admin roles", async () => {
    const login = await ctx.post(`${API}/auth/login`, {
      data: { email: "sales@srfpowermachine.com", password: "Sales@123" },
    });
    test.skip(!login.ok(), "no seeded sales user in this database");
    const salesToken = (await login.json()).data.accessToken;

    const res = await ctx.post(`${API}/leads/bulk-delete`, {
      headers: { Authorization: `Bearer ${salesToken}` },
      data: { ids: ["6a2fd6538697ccd799bea02a"] },
    });
    expect(res.status()).toBe(403);
  });
});

test.describe("Dashboard rolls up the wider status list", () => {
  test("open/won/lost buckets are present and non-negative", async () => {
    const res = await ctx.get(`${API}/dashboard`);
    expect(res.ok(), await res.text()).toBeTruthy();
    const { leads } = (await res.json()).data;
    for (const key of ["total", "new", "inProgress", "converted", "lost"]) {
      expect(typeof leads[key], `leads.${key}`).toBe("number");
      expect(leads[key]).toBeGreaterThanOrEqual(0);
    }
    // Buckets are disjoint slices of the same population.
    expect(leads.new + leads.inProgress + leads.converted + leads.lost).toBeLessThanOrEqual(
      leads.total,
    );
  });
});
