import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { API, RUN_TAG, adminApi, createLead, sweepRunFixtures, waitForTable } from "./helpers";

/**
 * The 11 August list is written for the people who use the CRM daily — sales
 * executives, not the admin account every other spec logs in as. This walks the
 * same features as a **sales** user, because a feature only an admin can reach
 * is not delivered.
 */

const SALES = {
  name: `${RUN_TAG} Sales Exec`,
  email: `${RUN_TAG.toLowerCase()}.sales@e2e.test`,
  password: "Sales@1234",
  role: "sales",
};

let ctx: APIRequestContext;
let salesUserId = "";
const cleanup: { path: string; id: string }[] = [];
const track = (path: string, id: string) => cleanup.push({ path, id });

test.beforeAll(async () => {
  ({ ctx } = await adminApi());
  const created = await ctx.post(`${API}/auth/users`, { data: SALES });
  expect(created.status(), await created.text()).toBe(201);
  salesUserId = (await created.json()).data.id;
});

test.afterAll(async () => {
  for (const c of [...cleanup].reverse()) {
    await ctx.delete(`${API}/${c.path}/${c.id}`).catch(() => undefined);
  }
  // Deactivate rather than delete — users are referenced by the records they
  // touched, and there is no user-delete endpoint by design.
  if (salesUserId) {
    await ctx.patch(`${API}/auth/users/${salesUserId}`, { data: { isActive: false } });
  }
  await sweepRunFixtures(ctx);
  await ctx.dispose();
});

async function loginAsSales(page: Page) {
  await page.goto("/login");
  // Field ids, not placeholder copy — see the note on uiLogin in helpers.ts.
  await page.locator("#email").fill(SALES.email);
  await page.locator("#password").fill(SALES.password);
  await page.getByRole("button", { name: /Sign In|Login/i }).click();
  await expect(page).toHaveURL(/\/(dashboard|leads)?$/, { timeout: 15000 });
}

test("a sales executive can reach every day-to-day feature the list asks for", async ({ page }) => {
  // Sales users see the leads assigned to them, so assign this one.
  const lead = await createLead(ctx, {
    customerName: `${RUN_TAG} SalesRole`,
    assignedTo: salesUserId,
  });
  track("leads", lead.id);

  await loginAsSales(page);

  // Point 1 — the send buttons are on the row, for this role too.
  await page.goto("/leads");
  await page.getByPlaceholder("Customer, mobile, city, requirement...").fill(RUN_TAG);
  await waitForTable(page);
  await expect(page.getByTestId(`whatsapp-${lead.id}`)).toBeVisible();
  await expect(page.getByTestId(`email-${lead.id}`)).toBeVisible();
  await expect(page.getByTestId(`call-${lead.id}`)).toBeVisible();

  // Point 8 — Received first, with the date window. Column headers are
  // uppercased in CSS and innerText reflects text-transform, so compare on the
  // underlying label rather than the rendered casing.
  const headers = (await page.locator("table thead th").allInnerTexts()).map((h) =>
    h.trim().toLowerCase(),
  );
  expect(headers).toContain("received");
  await expect(page.getByTestId("lead-end-date")).toBeVisible();

  // Point 1 — the lead opens with its history.
  await page.goto(`/leads/${lead.id}`);
  await expect(page.getByTestId("lead-detail")).toBeVisible();
  await expect(page.getByTestId("detail-calculate")).toBeVisible();
  await expect(page.getByTestId("open-log-call")).toBeVisible();

  // Point 4 — the calculator, and the quotation it feeds.
  await page.getByTestId("detail-calculate").click();
  await expect(page.getByTestId("calc-for-lead")).toContainText(`${RUN_TAG} SalesRole`);
  await page.getByRole("button", { name: "Calculate" }).click();
  await expect(page.getByTestId("calc-to-quote")).toBeVisible();
  await page.getByTestId("calc-create-quotation").click();
  await expect(page.getByRole("dialog", { name: "New Document" })).toBeVisible();
  await expect(page.locator("input[name='customerName']")).toHaveValue(`${RUN_TAG} SalesRole`);
});

test("a sales executive sees the master lists the dropdowns depend on", async ({ page }) => {
  // Reading these is what makes the dropdowns work; managing them stays admin-side.
  const loc = (
    await (await ctx.post(`${API}/locations`, { data: { name: `${RUN_TAG} Sales Yard` } })).json()
  ).data;
  track("locations", loc.id);
  const tpl = (
    await (
      await ctx.post(`${API}/templates`, {
        data: { kind: "terms", name: `${RUN_TAG} Sales Terms`, body: "50% advance." },
      })
    ).json()
  ).data;
  track("templates", tpl.id);

  await loginAsSales(page);

  await page.goto("/quotations");
  await waitForTable(page);
  await page.getByRole("button", { name: /New Quotation/ }).click();
  // Point 4 — both preset dropdowns are usable by this role.
  await expect(page.getByTestId("terms-template-picker")).toBeVisible();
  await page.getByTestId("terms-template-picker").selectOption(tpl.id);
  await expect(page.locator("#terms-text")).toHaveValue("50% advance.");
  await expect(page.getByTestId("product-picker-0")).toBeVisible();

  // Point 9 — the location list is readable, so the dropdown is not empty.
  const locations = await ctx.get(`${API}/locations?search=${RUN_TAG}&limit=5`);
  expect(locations.status()).toBe(200);
  await page.goto("/sales");
  await expect(
    page
      .getByTestId("sale-location-filter")
      .locator("option", { hasText: `${RUN_TAG} Sales Yard` }),
  ).toHaveCount(1);

  // Point 9 — the Leads filter is a dropdown too, not a free-text box.
  await page.goto("/leads");
  await waitForTable(page);
  const leadFilter = page.getByTestId("lead-location-filter");
  await expect(leadFilter).toBeVisible();
  // Lead cities come from IndiaMART and run to hundreds, so this drops down the
  // known ones while still accepting a city that has only just arrived.
  const listId = await leadFilter.getAttribute("list");
  expect(listId).toBeTruthy();
  await expect(
    page.locator(`datalist#${listId} option[value="${RUN_TAG} Sales Yard"]`),
  ).toHaveCount(1);
});

test("configuration stays with the admin", async ({ page }) => {
  await loginAsSales(page);

  // Settings holds the letterhead and invoice series — admin only, by design.
  await page.goto("/settings");
  await expect(page.getByText("Letterhead (PDF header & footer)")).toHaveCount(0);
});
