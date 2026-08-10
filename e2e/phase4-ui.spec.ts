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
 * Change Request Phase 4 — browser behaviour in Chromium.
 *
 * Point 13 — clicking a lead opens its detail workspace
 * Point 14 — the lead's history is shown inline
 * Point 11 — Manage Lead: labels, notes, reminders; and the dashboard widget
 */

let ctx: APIRequestContext;
const leadIds: string[] = [];
const labelIds: string[] = [];

test.beforeAll(async () => {
  ({ ctx } = await adminApi());
});

test.afterAll(async () => {
  for (const id of leadIds) await ctx.delete(`${API}/leads/${id}`).catch(() => undefined);
  for (const id of labelIds) await ctx.delete(`${API}/lead-labels/${id}`).catch(() => undefined);
  await sweepRunFixtures(ctx);
  await ctx.dispose();
});

test.beforeEach(async ({ page }) => {
  await uiLogin(page);
});

async function seedLead(overrides: Record<string, unknown> = {}) {
  const lead = await createLead(ctx, overrides);
  leadIds.push(lead.id);
  return lead;
}

async function seedLabel(name: string) {
  const res = await ctx.post(`${API}/lead-labels`, { data: { name, color: "violet" } });
  expect(res.status(), await res.text()).toBe(201);
  const label = (await res.json()).data;
  labelIds.push(label.id);
  return label;
}

test.describe("Point 13 — the lead detail workspace", () => {
  test("clicking a lead name from the list opens its detail page", async ({ page }) => {
    const lead = await seedLead({ customerName: `${RUN_TAG} Clickable` });

    await page.goto("/leads");
    await page.getByPlaceholder("Customer, mobile, city, requirement...").fill(RUN_TAG);
    await waitForTable(page);

    await page.getByTestId(`open-lead-${lead.id}`).click();
    await page.waitForURL(new RegExp(`/leads/${lead.id}`));

    const detail = page.getByTestId("lead-detail");
    await expect(detail).toBeVisible();
    await expect(page.getByRole("heading", { name: `${RUN_TAG} Clickable` })).toBeVisible();
  });

  test("shows engagement counters, contact details and the requirement", async ({ page }) => {
    const lead = await seedLead({
      customerName: `${RUN_TAG} Detailed`,
      requirement: "125 kVA silent diesel genset for cold storage",
      requiredKva: 125,
      quantity: 4,
    });
    await ctx.post(`${API}/leads/${lead.id}/calls`, { data: { outcome: "connected" } });

    await page.goto(`/leads/${lead.id}`);
    const detail = page.getByTestId("lead-detail");
    await expect(detail).toBeVisible();

    // Engagement tiles, mirroring the reference screen.
    const tiles = page.getByTestId("engagement-tiles");
    await expect(tiles).toContainText("Requirements");
    await expect(tiles).toContainText("Calls");
    await expect(tiles).toContainText("Replies");
    // One call was logged.
    await expect(tiles).toContainText("1");

    await expect(detail).toContainText("Contact Details");
    await expect(detail).toContainText("125 kVA silent diesel genset");
    await expect(detail).toContainText("125 kVA");
    await expect(detail).toContainText("Qty 4");
  });

  test("point 14: the History tab lists every event on the lead", async ({ page }) => {
    const lead = await seedLead({ customerName: `${RUN_TAG} Historic` });
    await ctx.post(`${API}/leads/${lead.id}/calls`, {
      data: { outcome: "connected", note: "Talked through the spec" },
    });
    await ctx.post(`${API}/leads/${lead.id}/follow-ups`, { data: { note: "Quote to follow" } });

    await page.goto(`/leads/${lead.id}`);
    await page.getByRole("button", { name: "History", exact: true }).click();

    const history = page.getByTestId("lead-history");
    await expect(history).toBeVisible();
    await expect(history).toContainText("Lead Created");
    await expect(history).toContainText("Call");
    await expect(history).toContainText("Talked through the spec");
    await expect(history).toContainText("Follow-up");
  });

  test("the Documents tab shows quotations raised from the lead", async ({ page }) => {
    const lead = await seedLead({ customerName: `${RUN_TAG} WithDocs` });
    const q = await ctx.post(`${API}/quotations`, {
      data: {
        docType: "quotation",
        lead: lead.id,
        customerName: `${RUN_TAG} WithDocs`,
        items: [{ description: "125 kVA genset", quantity: 1, unitPrice: 950000, taxRate: 18 }],
      },
    });
    expect(q.status()).toBe(201);
    const doc = (await q.json()).data;

    await page.goto(`/leads/${lead.id}`);
    await page.getByRole("button", { name: /^Documents/ }).click();
    await expect(page.getByText(doc.docNumberFormatted)).toBeVisible();
    await expect(page.getByText("This lead has not converted to a sale.")).toBeVisible();
  });

  test("logging a call from the detail page bumps the counter and the status", async ({ page }) => {
    const lead = await seedLead({ customerName: `${RUN_TAG} CallFromUI`, status: "new" });

    await page.goto(`/leads/${lead.id}`);
    await page.getByTestId("open-log-call").click();
    await page.locator("#call-outcome").selectOption("connected");
    await page.locator("#call-note").fill("Customer asked for a revised price");
    await page.getByTestId("submit-call").click();

    // Counter goes to 1 and the pipeline status advances off "New".
    await expect(page.getByTestId("engagement-tiles")).toContainText("1");
    await expect(page.getByTestId("lead-detail")).toContainText("Contacted");
  });
});

test.describe("Point 11 — Manage Lead: labels, notes, reminders", () => {
  test("attaches an existing label and shows it on the lead", async ({ page }) => {
    const label = await seedLabel(`${RUN_TAG} Hot`);
    const lead = await seedLead({ customerName: `${RUN_TAG} Labelling` });

    await page.goto(`/leads/${lead.id}`);
    await page.getByTestId("open-manage-lead").click();

    const panel = page.getByTestId("manage-lead");
    await expect(panel).toBeVisible();
    await page.getByTestId(`label-chip-${label.id}`).click();
    // The dialog footer's Save — exact, so it doesn't also match "Save Note".
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(panel).toBeHidden();

    await expect(page.getByTestId(`detail-label-${label.id}`)).toBeVisible();
    await expect(page.getByTestId(`detail-label-${label.id}`)).toContainText(`${RUN_TAG} Hot`);
  });

  test("creates a new label from inside the panel", async ({ page }) => {
    const lead = await seedLead({ customerName: `${RUN_TAG} NewLabel` });

    await page.goto(`/leads/${lead.id}`);
    await page.getByTestId("open-manage-lead").click();
    await page.getByLabel("New label name").fill(`${RUN_TAG} Fresh`);
    await page.getByTestId("create-label").click();

    // Wait for the create to land before reading it back over the API.
    await expect(page.getByText(`Label "${RUN_TAG} Fresh" created`)).toBeVisible();

    // It appears as a chip and is auto-selected.
    const created = await ctx.get(`${API}/lead-labels`);
    const label = ((await created.json()).data as Array<{ id: string; name: string }>).find(
      (l) => l.name === `${RUN_TAG} Fresh`,
    );
    expect(label).toBeTruthy();
    labelIds.push(label!.id);
    await expect(page.getByTestId(`label-chip-${label!.id}`)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("saves a note with a live character counter", async ({ page }) => {
    const lead = await seedLead({ customerName: `${RUN_TAG} Noted` });

    await page.goto(`/leads/${lead.id}`);
    await page.getByTestId("open-manage-lead").click();

    const panel = page.getByTestId("manage-lead");
    await expect(panel).toContainText("0/4000 Characters");
    await page.getByLabel("Lead note").fill("Customer wants delivery before Diwali");
    await expect(panel).toContainText("37/4000 Characters");
    await page.getByTestId("save-note").click();

    // It lands on the lead's history.
    await page.reload();
    await page.getByRole("button", { name: "History", exact: true }).click();
    await expect(page.getByTestId("lead-history")).toContainText(
      "Customer wants delivery before Diwali",
    );
  });

  test("the Tomorrow preset sets a reminder that shows on the lead", async ({ page }) => {
    const lead = await seedLead({ customerName: `${RUN_TAG} Reminded` });

    await page.goto(`/leads/${lead.id}`);
    await page.getByTestId("open-manage-lead").click();
    await page.getByTestId("remind-tomorrow").click();

    await expect(page.getByTestId("pending-reminders")).toBeVisible();

    // And it is stored against the lead at tomorrow 10:00 local.
    const list = await ctx.get(`${API}/reminders?leadId=${lead.id}`);
    const items = (await list.json()).data as Array<{ remindAt: string }>;
    expect(items).toHaveLength(1);
    const at = new Date(items[0].remindAt);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(at.getDate()).toBe(tomorrow.getDate());
    expect(at.getHours()).toBe(10);
  });

  test("a status chip in the panel changes the lead's pipeline status", async ({ page }) => {
    const lead = await seedLead({ customerName: `${RUN_TAG} StatusChip`, status: "new" });

    await page.goto(`/leads/${lead.id}`);
    await page.getByTestId("open-manage-lead").click();
    await page.getByTestId("status-chip-negotiation").click();

    // Wait for the save to land before reading it back over the API.
    await expect(page.getByText("Status set to Negotiation")).toBeVisible();

    const after = (await (await ctx.get(`${API}/leads/${lead.id}`)).json()).data;
    expect(after.status).toBe("negotiation");
  });
});

test.describe("The dashboard reminders widget", () => {
  test("lists my due reminders and lets me complete one", async ({ page }) => {
    const lead = await seedLead({ customerName: `${RUN_TAG} DashLead` });
    const created = await ctx.post(`${API}/reminders`, {
      data: {
        lead: lead.id,
        remindAt: new Date(Date.now() - 60_000).toISOString(),
        note: `${RUN_TAG} ring back`,
      },
    });
    const reminder = (await created.json()).data;

    await page.goto("/dashboard");
    const panel = page.getByTestId("reminders-panel");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText(`${RUN_TAG} DashLead`);
    await expect(panel).toContainText("due now");

    // The lead name links through to the detail page.
    await expect(panel.getByRole("link", { name: `${RUN_TAG} DashLead` })).toHaveAttribute(
      "href",
      `/leads/${lead.id}`,
    );

    await page.getByTestId(`reminder-${reminder.id}`).getByRole("button").click();
    await expect(page.getByTestId(`reminder-${reminder.id}`)).toHaveCount(0);
  });
});
