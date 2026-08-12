import { test, expect, type APIRequestContext } from "@playwright/test";
import { API, RUN_TAG, adminApi, createLead, sweepRunFixtures } from "./helpers";

/**
 * 11 August change request — API contract.
 *
 * Point 4 — templates for description / T&C / email / WhatsApp
 * Point 7 — lead import with a published column spec
 * Point 9 — Location master list feeding the dropdowns
 * Points 1 & 2 — sending a message, and getting the PDF itself to the customer
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

test.describe("Point 9 — Location master list", () => {
  test("a location is created and its name is unique, case-insensitively", async () => {
    const res = await ctx.post(`${API}/locations`, {
      data: { name: `${RUN_TAG} Mumbai Yard`, city: "Mumbai", state: "Maharashtra" },
    });
    expect(res.status(), await res.text()).toBe(201);
    const loc = (await res.json()).data;
    track("locations", loc.id);
    expect(loc.name).toBe(`${RUN_TAG} Mumbai Yard`);

    const dup = await ctx.post(`${API}/locations`, {
      data: { name: `${RUN_TAG.toLowerCase()} mumbai yard` },
    });
    expect(dup.status()).toBe(409);
    expect((await dup.json()).error.code).toBe("DUPLICATE_LOCATION");
  });

  test("renaming a location follows through to the stock stamped with it", async () => {
    const loc = (
      await (await ctx.post(`${API}/locations`, { data: { name: `${RUN_TAG} Old Yard` } })).json()
    ).data;
    track("locations", loc.id);

    const inv = (
      await (
        await ctx.post(`${API}/inventory`, {
          data: { model: `${RUN_TAG}-LOCGEN`, kva: 15, location: `${RUN_TAG} Old Yard` },
        })
      ).json()
    ).data;
    track("inventory", inv.id);

    await ctx.patch(`${API}/locations/${loc.id}`, { data: { name: `${RUN_TAG} New Yard` } });

    const after = (await (await ctx.get(`${API}/inventory/${inv.id}`)).json()).data;
    expect(after.location, "the stock row kept the old spelling").toBe(`${RUN_TAG} New Yard`);
  });

  test("a location still in use cannot be deleted", async () => {
    const loc = (
      await (await ctx.post(`${API}/locations`, { data: { name: `${RUN_TAG} Busy Yard` } })).json()
    ).data;
    track("locations", loc.id);
    const inv = (
      await (
        await ctx.post(`${API}/inventory`, {
          data: { model: `${RUN_TAG}-BUSY`, kva: 10, location: `${RUN_TAG} Busy Yard` },
        })
      ).json()
    ).data;
    track("inventory", inv.id);

    const res = await ctx.delete(`${API}/locations/${loc.id}`);
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("LOCATION_IN_USE");
    // The message tells the user what to do instead.
    expect(body.error.message).toMatch(/deactivate/i);
  });

  test("the list reports how many records use each location", async () => {
    const res = await ctx.get(`${API}/locations?limit=100`);
    const items = (await res.json()).data as Array<{ name: string; usage?: { total: number } }>;
    const busy = items.find((l) => l.name === `${RUN_TAG} Busy Yard`);
    expect(busy?.usage?.total).toBeGreaterThanOrEqual(1);
  });
});

test.describe("Point 4 — templates", () => {
  test("all four kinds can be created, and names are unique per kind", async () => {
    for (const kind of ["description", "terms", "email", "whatsapp"] as const) {
      const res = await ctx.post(`${API}/templates`, {
        data: { kind, name: `${RUN_TAG} Standard`, body: "Hello {{customerName}}" },
      });
      expect(res.status(), `${kind}: ${await res.text()}`).toBe(201);
      track("templates", (await res.json()).data.id);
    }
    // The same name is fine across kinds, but not twice within one.
    const dup = await ctx.post(`${API}/templates`, {
      data: { kind: "terms", name: `${RUN_TAG.toLowerCase()} standard` },
    });
    expect(dup.status()).toBe(409);
    expect((await dup.json()).error.code).toBe("DUPLICATE_TEMPLATE");
  });

  test("a terms template comes back pre-split into conditions", async () => {
    const res = await ctx.post(`${API}/templates`, {
      data: {
        kind: "terms",
        name: `${RUN_TAG} Payment terms`,
        body: "50% advance.\nBalance before dispatch.\n\nDelivery in 4 weeks.",
      },
    });
    expect(res.status()).toBe(201);
    const t = (await res.json()).data;
    track("templates", t.id);
    // Blank lines are dropped, so the quotation gets three clean conditions.
    expect(t.lines).toEqual(["50% advance.", "Balance before dispatch.", "Delivery in 4 weeks."]);
  });

  test("only one template per kind is the default", async () => {
    const first = (
      await (
        await ctx.post(`${API}/templates`, {
          data: { kind: "whatsapp", name: `${RUN_TAG} First`, isDefault: true },
        })
      ).json()
    ).data;
    track("templates", first.id);
    const second = (
      await (
        await ctx.post(`${API}/templates`, {
          data: { kind: "whatsapp", name: `${RUN_TAG} Second`, isDefault: true },
        })
      ).json()
    ).data;
    track("templates", second.id);

    const list = await ctx.get(`${API}/templates?kind=whatsapp&limit=100`);
    const defaults = ((await list.json()).data as Array<{ id: string; isDefault: boolean }>).filter(
      (t) => t.isDefault,
    );
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe(second.id);
  });

  test("the placeholder catalogue is published for the editor", async () => {
    const res = await ctx.get(`${API}/templates/meta`);
    expect(res.ok()).toBeTruthy();
    const meta = (await res.json()).data;
    const tokens = (meta.placeholders as Array<{ token: string }>).map((p) => p.token);
    expect(tokens).toEqual(expect.arrayContaining(["customerName", "docNumber", "docLink"]));
  });
});

test.describe("Point 7 — lead import", () => {
  test("the column spec is published before any file is chosen", async () => {
    const res = await ctx.get(`${API}/leads/import/spec`);
    expect(res.ok()).toBeTruthy();
    const spec = (await res.json()).data;
    expect(spec.notes.length).toBeGreaterThan(3);
    const required = (spec.columns as Array<{ column: string; required: boolean }>).filter(
      (c) => c.required,
    );
    // Only the name is mandatory — everything else is optional.
    expect(required.map((c) => c.column)).toEqual(["Customer Name"]);
    expect(spec.columns.every((c: { example: string }) => c.example !== undefined)).toBe(true);
  });

  test("a pre-formatted template can be downloaded", async () => {
    const res = await ctx.get(`${API}/leads/import/template`);
    expect(res.ok()).toBeTruthy();
    expect(res.headers()["content-type"]).toContain("spreadsheetml");
    expect((await res.body()).length).toBeGreaterThan(1000);
  });

  test("good rows import and bad rows are reported with their row number", async () => {
    const csv = [
      "Customer Name,Mobile,Email,City,KVA,Quantity,Source,Status",
      `${RUN_TAG} Import Good,+91 98765 43210,good@import.test,Pune,125,2,indiamart,new`,
      ",9999999999,,,,,,",
      `${RUN_TAG} Import BadEmail,9876500002,not-an-email,Mumbai,10,1,walk_in,contacted`,
    ].join("\n");

    const res = await ctx.post(`${API}/leads/import`, {
      data: { fileBase64: Buffer.from(csv, "utf8").toString("base64") },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    const result = (await res.json()).data;

    expect(result.total).toBe(3);
    expect(result.created).toBe(1);
    expect(result.skipped).toBe(2);
    // Row numbers point at the spreadsheet, not the array index.
    expect(result.errors).toEqual([
      { row: 3, message: "Missing Customer Name" },
      expect.objectContaining({ row: 4 }),
    ]);

    // The good row landed with its fields parsed.
    const list = await ctx.get(`${API}/leads?search=${RUN_TAG} Import Good&limit=5`);
    const items = (await list.json()).data as Array<Record<string, unknown>>;
    expect(items).toHaveLength(1);
    track("leads", items[0].id as string);
    expect(items[0].mobile).toBe("+919876543210");
    expect(items[0].quantity).toBe(2);
    expect(items[0].source).toBe("indiamart");
  });
});

test.describe("Points 1 & 2 — sending, and getting the PDF to the customer", () => {
  test("capabilities report which provider is live", async () => {
    const res = await ctx.get(`${API}/messages/capabilities`);
    expect(res.ok()).toBeTruthy();
    const caps = (await res.json()).data;
    for (const channel of ["whatsapp", "email"] as const) {
      expect(typeof caps[channel].configured).toBe("boolean");
      expect(typeof caps[channel].canAttach).toBe("boolean");
      expect(caps[channel].provider).toBeTruthy();
    }
    expect(caps.documentLinkTtlDays).toBeGreaterThan(0);
  });

  test("a document link opens the PDF without a login, and rejects tampering", async () => {
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} LinkLead` });
    track("leads", lead.id);
    const doc = (
      await (
        await ctx.post(`${API}/quotations`, {
          data: {
            docType: "quotation",
            lead: lead.id,
            customerName: `${RUN_TAG} LinkLead`,
            items: [{ description: "125 kVA genset", quantity: 1, unitPrice: 950000, taxRate: 18 }],
          },
        })
      ).json()
    ).data;
    track("quotations", doc.id);

    const link = (await (await ctx.get(`${API}/messages/document-link/${doc.id}`)).json()).data;
    expect(link.url).toContain("/d/");

    // A brand-new context proves no session is involved.
    const anon = await ctx.get(link.url, { headers: { Authorization: "" } });
    expect(anon.ok(), "the public link should open without auth").toBeTruthy();
    expect(anon.headers()["content-type"]).toContain("application/pdf");
    expect((await anon.body()).subarray(0, 5).toString()).toBe("%PDF-");
    // Not cached or indexed — it is a private customer document.
    expect(anon.headers()["cache-control"]).toContain("no-store");

    // A tampered signature is refused rather than served.
    expect((await ctx.get(`${link.url}x`)).status()).toBe(403);
    expect((await ctx.get(`${link.url.split("/d/")[0]}/d/not-a-token`)).status()).toBe(403);
  });

  test("sending renders the template and carries the document link", async () => {
    const lead = await createLead(ctx, {
      customerName: `${RUN_TAG} SendLead`,
      mobile: "9876500321",
    });
    track("leads", lead.id);
    const doc = (
      await (
        await ctx.post(`${API}/quotations`, {
          data: {
            docType: "quotation",
            lead: lead.id,
            customerName: `${RUN_TAG} SendLead`,
            items: [{ description: "15 kVA genset", quantity: 1, unitPrice: 170000, taxRate: 18 }],
          },
        })
      ).json()
    ).data;
    track("quotations", doc.id);

    const template = (
      await (
        await ctx.post(`${API}/templates`, {
          data: {
            kind: "whatsapp",
            name: `${RUN_TAG} Send`,
            body: "Hi {{customerName}}, quotation {{docNumber}} for {{docTotal}}.",
          },
        })
      ).json()
    ).data;
    track("templates", template.id);

    const res = await ctx.post(`${API}/messages`, {
      data: {
        leadId: lead.id,
        channel: "whatsapp",
        templateId: template.id,
        documentId: doc.id,
      },
    });
    expect(res.status(), await res.text()).toBe(201);
    const msg = (await res.json()).data;

    // Placeholders resolved against the real lead and document.
    expect(msg.body).toContain(`${RUN_TAG} SendLead`);
    expect(msg.body).toContain(doc.docNumberFormatted);
    expect(msg.body).not.toContain("{{");
    // The PDF travels either as an attachment or as this link.
    expect(msg.documentUrl).toContain("/d/");
    // Without credentials the honest status is "handoff", never "sent".
    expect(["sent", "handoff"]).toContain(msg.status);
    if (msg.status === "handoff") {
      expect(msg.handoffUrl).toContain("wa.me");
      expect(decodeURIComponent(msg.handoffUrl)).toContain(msg.documentUrl);
    }

    // Logged against the lead, and the lead counts as contacted.
    const thread = await ctx.get(`${API}/messages/lead/${lead.id}`);
    expect(((await thread.json()).data as unknown[]).length).toBe(1);
    const after = (await (await ctx.get(`${API}/leads/${lead.id}`)).json()).data;
    expect(after.status).toBe("contacted");
  });

  test("an empty message is refused", async () => {
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} EmptyMsg` });
    track("leads", lead.id);
    const res = await ctx.post(`${API}/messages`, {
      data: { leadId: lead.id, channel: "whatsapp", body: "   " },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe("Point 8 — filtering by when a lead arrived", () => {
  test("the date window bounds the result set", async () => {
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} DateFilter` });
    track("leads", lead.id);

    const today = new Date().toISOString().slice(0, 10);
    const included = await ctx.get(`${API}/leads?search=${RUN_TAG} DateFilter&startDate=${today}`);
    expect(((await included.json()).data as unknown[]).length).toBe(1);

    // A window that closed yesterday must exclude it.
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const excluded = await ctx.get(
      `${API}/leads?search=${RUN_TAG} DateFilter&endDate=${yesterday}`,
    );
    expect(((await excluded.json()).data as unknown[]).length).toBe(0);
  });
});

test.describe("Point 4 — sizing feeds the quotation", () => {
  test("the catalog suggests only gensets that carry the calculated load", async () => {
    // A 25 kVA load must not be offered a 15 kVA set.
    const small = (
      await (
        await ctx.post(`${API}/products`, {
          data: { name: `${RUN_TAG} Small 15`, kva: 15, price: 210000 },
        })
      ).json()
    ).data;
    track("products", small.id);
    const fit = (
      await (
        await ctx.post(`${API}/products`, {
          data: { name: `${RUN_TAG} Fit 30`, kva: 30, price: 380000, shortDescription: "30 kVA" },
        })
      ).json()
    ).data;
    track("products", fit.id);

    const res = await ctx.get(`${API}/products/options?minKva=25&limit=50`);
    expect(res.status()).toBe(200);
    const options = (await res.json()).data as Array<{ id: string; kva?: number }>;
    expect(options.some((o) => o.id === fit.id)).toBe(true);
    expect(options.some((o) => o.id === small.id)).toBe(false);
    // Smallest first, so the cheapest set that fits leads.
    const kvas = options.map((o) => o.kva ?? 0);
    expect([...kvas].sort((a, b) => a - b)).toEqual(kvas);
  });

  test("the calculation the quotation is built from is reproducible", async () => {
    const res = await ctx.post(`${API}/capacity/calculate`, {
      data: {
        appliances: [
          { category: "ac", name: "1.5 Ton AC", quantity: 2, watts: 1500 },
          { category: "motor", name: "Water pump", quantity: 1, watts: 2200 },
        ],
        powerFactor: 0.8,
        safetyMarginPct: 25,
      },
    });
    expect(res.status()).toBe(200);
    const result = (await res.json()).data;
    expect(result.recommendedStandardKva).toBeGreaterThan(result.runningKva);
    expect(result.peakKva).toBeGreaterThanOrEqual(result.runningKva);
    expect(result.surgeContributor).toBeTruthy();
  });
});

test.describe("Second pass — gaps found re-reading the 11-August list", () => {
  test("point 9: Inventory and Sales accept the same date window as Leads", async () => {
    const inv = (
      await (
        await ctx.post(`${API}/inventory`, {
          data: {
            model: `${RUN_TAG}-DateFilter`,
            brand: "Mahindra",
            kva: 25,
            availableQuantity: 1,
          },
        })
      ).json()
    ).data;
    track("inventory", inv.id);

    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    // Search on the unique model, so other fixtures in this run cannot inflate it.
    const q = `${RUN_TAG}-DateFilter`;
    const inWindow = await ctx.get(`${API}/inventory?search=${q}&startDate=${today}`);
    expect(((await inWindow.json()).data as unknown[]).length).toBe(1);
    const outOfWindow = await ctx.get(`${API}/inventory?search=${q}&endDate=${yesterday}`);
    expect(((await outOfWindow.json()).data as unknown[]).length).toBe(0);

    // Sales take the window on saleDate.
    const sale = await ctx.get(`${API}/sales?startDate=${today}&endDate=${today}`);
    expect(sale.status()).toBe(200);
  });

  test("point 4: the catalog can be seeded from the models already in Inventory", async () => {
    const inv = (
      await (
        await ctx.post(`${API}/inventory`, {
          data: {
            model: `${RUN_TAG}-SEED-1`,
            brand: `${RUN_TAG}Brand`,
            kva: 62.5,
            fuelType: "diesel",
            phase: "three",
            sellingPrice: 555000,
            availableQuantity: 2,
          },
        })
      ).json()
    ).data;
    track("inventory", inv.id);

    const first = await ctx.post(`${API}/products/seed-from-inventory`);
    expect(first.status(), await first.text()).toBe(200);
    expect((await first.json()).data.created).toBeGreaterThanOrEqual(1);

    const listed = await ctx.get(`${API}/products?search=${RUN_TAG}&limit=10`);
    const items = (await listed.json()).data as Array<{
      id: string;
      price: number;
      kva?: number;
      quotationDefaults: { description: string; unitPrice: number };
    }>;
    const seeded = items.find((p) => p.kva === 62.5);
    expect(seeded, "the stocked model should now be in the catalog").toBeTruthy();
    track("products", seeded!.id);
    // The price and description come across ready to drop into a quotation.
    expect(seeded!.quotationDefaults.unitPrice).toBe(555000);
    expect(seeded!.quotationDefaults.description).toContain("62.5 kVA");

    // Running it again must not duplicate what is already there.
    const second = await ctx.post(`${API}/products/seed-from-inventory`);
    const secondBody = (await second.json()).data;
    expect(secondBody.created).toBe(0);
    expect(secondBody.skipped).toBeGreaterThanOrEqual(1);
  });

  test("point 1: a lead's own documents can be listed for sending", async () => {
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} DocsOfLead` });
    track("leads", lead.id);

    const doc = (
      await (
        await ctx.post(`${API}/quotations`, {
          data: {
            docType: "quotation",
            lead: lead.id,
            customerName: `${RUN_TAG} DocsOfLead`,
            customerMobile: "9876500001",
            items: [{ description: "25 kVA genset", quantity: 1, unitPrice: 300000, taxRate: 18 }],
          },
        })
      ).json()
    ).data;
    track("quotations", doc.id);

    const mine = await ctx.get(`${API}/quotations?lead=${lead.id}&limit=10`);
    const docs = (await mine.json()).data as Array<{ id: string }>;
    expect(docs).toHaveLength(1);
    expect(docs[0].id).toBe(doc.id);

    // And that document can be sent to the lead's own number.
    const sent = await ctx.post(`${API}/messages`, {
      data: {
        leadId: lead.id,
        channel: "whatsapp",
        body: "Sharing the quotation.",
        documentId: doc.id,
      },
    });
    expect(sent.status(), await sent.text()).toBe(201);
    const msg = (await sent.json()).data;
    expect(msg.documentUrl).toBeTruthy();
    expect(msg.toAddress).toBe("9876500001");
  });
});

test.describe("Second pass — a deleted lead takes its conversation with it", () => {
  test("messages are cascaded, not orphaned", async () => {
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} CascadeMsg` });

    const sent = await ctx.post(`${API}/messages`, {
      data: { leadId: lead.id, channel: "whatsapp", body: `${RUN_TAG} cascade check` },
    });
    expect(sent.status()).toBe(201);
    expect(
      ((await (await ctx.get(`${API}/messages/lead/${lead.id}`)).json()).data as unknown[]).length,
    ).toBe(1);

    await ctx.delete(`${API}/leads/${lead.id}`);

    // The thread goes with the lead, the way its reminders already do: the
    // conversation is unreachable, and the rows are soft-deleted rather than
    // left pointing at a lead that no longer exists.
    const after = await ctx.get(`${API}/messages/lead/${lead.id}`);
    expect(after.status()).toBe(404);
  });
});
