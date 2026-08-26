import { test, type APIRequestContext, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { ADMIN, API, adminApi } from "./helpers";

/**
 * Screenshot capture for the client report on the 26 August work.
 *
 * Not a test — it asserts nothing. It drives the real application so every
 * picture in the report is the shipped product rather than a mock-up.
 *
 * Run with:  npx playwright test e2e/capture-aug26.spec.ts
 * Output:    ./report-shots/aug26-*.png, consumed by scripts/build-aug26-report.mjs
 */

const OUT = path.resolve("report-shots");

test.use({
  viewport: { width: 1440, height: 900 },
  // A light theme prints legibly; the dark one becomes a black rectangle.
  colorScheme: "light",
});

const created: { path: string; id: string }[] = [];

async function login(page: Page) {
  await page.goto("/login");
  await page.locator("#email").fill(ADMIN.email);
  await page.locator("#password").fill(ADMIN.password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

/** Wait for spinners and network to stop so no picture catches a half-drawn screen. */
async function settle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page
    .locator(".animate-spin")
    .first()
    .waitFor({ state: "hidden", timeout: 8000 })
    .catch(() => undefined);
  await page.waitForTimeout(700);
}

async function shot(page: Page, name: string) {
  await settle(page);
  await page.screenshot({ path: path.join(OUT, `aug26-${name}.png`), fullPage: false });
}

/** A lead in the recycle bin, so the bin has something to show. */
async function seedDeletedLead(ctx: APIRequestContext) {
  const res = await ctx.post(`${API}/leads`, {
    data: {
      customerName: "Ramesh Textiles (sample)",
      mobile: "9876500100",
      city: "Pune",
      requirement: "62.5 kVA silent genset for the dyeing unit",
      requiredKva: 62.5,
      estimatedValue: 450000,
      source: "walk_in",
    },
  });
  const lead = (await res.json()).data;
  await ctx.delete(`${API}/leads/${lead.id}`);
  return lead;
}

test("capture the 26 August work", async ({ page }) => {
  test.setTimeout(10 * 60_000);
  fs.mkdirSync(OUT, { recursive: true });
  const { ctx } = await adminApi();
  const binLead = await seedDeletedLead(ctx);

  await login(page);

  // ── Capacity calculator: the application chart and dual wattage ─────────
  await page.goto("/capacity-calculator");
  await settle(page);
  await shot(page, "01-calculator");

  // Open the chart picker so the transcribed appliance list is visible.
  const picker = page.getByTestId("preset-picker");
  if (await picker.count()) {
    await picker.selectOption({ label: /Refrigerator \/ freezer — 290 L/ }).catch(() => undefined);
    await settle(page);
    await picker.selectOption({ label: /Central AC — 1.5 ton/ }).catch(() => undefined);
    await settle(page);
    await shot(page, "02-calculator-chart");
  }

  // Calculate, so the recommendation and the load schedule are on screen.
  await page
    .getByRole("button", { name: /calculate/i })
    .first()
    .click()
    .catch(() => undefined);
  await settle(page);
  await page.waitForTimeout(1200);
  await shot(page, "03-calculator-result");

  // ── Quotations: the delete action and its confirmation ──────────────────
  await page.goto("/quotations");
  await settle(page);
  await shot(page, "04-quotations");

  const firstDelete = page.locator("[data-testid^='delete-']").first();
  if (await firstDelete.count()) {
    await firstDelete.click();
    await page.waitForTimeout(900);
    await shot(page, "05-quotation-delete-confirm");
    await page
      .getByRole("button", { name: /^Cancel$/ })
      .last()
      .click()
      .catch(() => undefined);
    await page.waitForTimeout(500);
  }

  // ── WhatsApp composer: the quick-template button ────────────────────────
  const wa = page.locator("[data-testid^='share-whatsapp-']").first();
  if (await wa.count()) {
    await wa.click();
    await page.waitForTimeout(1600);
    await shot(page, "06-whatsapp-quick-template");
    await page
      .getByRole("button", { name: /^Cancel$/ })
      .last()
      .click()
      .catch(() => undefined);
    await page.waitForTimeout(500);
  }

  // ── Leads: the recycle bin ──────────────────────────────────────────────
  await page.goto("/leads");
  await settle(page);
  await shot(page, "07-leads");

  await page.goto("/leads/trash");
  await settle(page);
  await page
    .getByPlaceholder(/search by name/i)
    .fill("Ramesh Textiles")
    .catch(() => undefined);
  await page.waitForTimeout(1600);
  await shot(page, "08-recycle-bin");

  // ── Attendance: the approved-leave panel ────────────────────────────────
  await page.goto("/attendance");
  await settle(page);
  await shot(page, "09-attendance-leave");

  // ── My Performance: payroll figures ─────────────────────────────────────
  await page.goto("/my-performance");
  await settle(page);
  await shot(page, "10-performance");

  // ── Reports as a SALES user: the export button is gone ──────────────────
  await page.goto("/reports");
  await settle(page);
  await shot(page, "11-reports-admin");

  await page.evaluate(() => {
    try {
      localStorage.clear();
    } catch {
      /* private mode */
    }
  });
  await page.goto("/login");
  await page.waitForTimeout(700);
  await page.locator("#email").fill("sales@srfpowermachine.com");
  await page.locator("#password").fill("Sales@123");
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  await page.goto("/reports");
  await settle(page);
  await shot(page, "12-reports-sales-no-export");

  // cleanup — the bin lead and anything else this run made
  await ctx.delete(`${API}/leads/${binLead.id}/permanent`).catch(() => undefined);
  for (const c of created) await ctx.delete(`${API}/${c.path}/${c.id}`).catch(() => undefined);
  await ctx.dispose();

  const files = fs.readdirSync(OUT).filter((f) => f.startsWith("aug26-"));
  console.log(`captured ${files.length} screenshots into ${OUT}`);
  files.sort().forEach((f) => console.log("  " + f));
});
