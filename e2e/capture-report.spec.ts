import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { ADMIN, API, adminApi } from "./helpers";

/**
 * Screenshot capture for the client-facing delivery report.
 *
 * Not a test — it asserts nothing about correctness. It drives the real app so
 * the pictures in the report are the actual product rather than mock-ups, which
 * is the whole point of sending a client a before/after document.
 *
 * Run with:  npx playwright test e2e/capture-report.spec.ts
 * Output:    ./report-shots/*.png, consumed by scripts/build-report.mjs
 */

const OUT = path.resolve("report-shots");

test.use({
  viewport: { width: 1440, height: 900 },
  // Deterministic rendering — the report is reproducible, and a light theme
  // prints legibly on paper where the dark one turns into a black rectangle.
  colorScheme: "light",
  // Headless Chromium has no camera, so the punch dialog would otherwise
  // photograph its own "no camera available" error and make a working feature
  // look broken in the client's report. Chromium's built-in fake device gives
  // the preview something real to show.
  permissions: ["camera", "geolocation"],
  geolocation: { latitude: 19.076, longitude: 72.8777 },
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--allow-file-access-from-files",
    ],
  },
});

/**
 * Demo sales, created only so the GST chart has something to draw, then voided
 * immediately after the shutter.
 *
 * They carry no `inventoryId`, so nothing is taken out of stock, and every one
 * is named "DEMO" so it is obvious in any list what it was. The screenshot is
 * captioned as sample data in the report — a client must never mistake numbers
 * we invented for their own revenue.
 */
const DEMO_PREFIX = "DEMO — sample data";
let ctx: APIRequestContext;
const demoSaleIds: string[] = [];

async function seedDemoSales() {
  const now = new Date();
  const rows = [
    { back: 5, amount: 850_000, gst: true },
    { back: 4, amount: 420_000, gst: false },
    { back: 3, amount: 1_250_000, gst: true },
    { back: 2, amount: 610_000, gst: true },
    { back: 1, amount: 300_000, gst: false },
    { back: 0, amount: 980_000, gst: true },
  ];
  for (const r of rows) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - r.back, 12));
    const res = await ctx.post(`${API}/sales`, {
      data: {
        modelName: "Demo Genset 125 kVA",
        quantity: 1,
        unitPrice: r.amount,
        customerName: `${DEMO_PREFIX} ${r.back}`,
        saleDate: d.toISOString(),
        gstTreatment: r.gst ? "gst" : "non_gst",
      },
    });
    if (res.ok()) demoSaleIds.push((await res.json()).data.id);
  }
}

test.beforeAll(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  ({ ctx } = await adminApi());
  await seedDemoSales();
});

test.afterAll(async () => {
  // Void every demo sale, whatever happened above.
  for (const id of demoSaleIds) {
    await ctx.delete(`${API}/sales/${id}`).catch(() => undefined);
  }
  await ctx.dispose();
});

async function login(page: Page) {
  await page.goto("/login");
  await page.locator("#email").fill(ADMIN.email);
  await page.locator("#password").fill(ADMIN.password);
  await page.getByRole("button", { name: /sign in|log in|login/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

/** Let charts finish their entry animation before the shutter. */
async function settle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(900);
}

async function shot(page: Page, name: string) {
  await settle(page);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
}

test("capture the delivered screens", async ({ page }) => {
  await login(page);

  // ── Dashboard, including the new GST vs Non-GST chart ──────────────────
  await page.goto("/dashboard");
  await shot(page, "01-dashboard");

  await page
    .getByText("Revenue — GST vs Non-GST")
    .scrollIntoViewIfNeeded()
    .catch(() => undefined);
  await shot(page, "02-gst-chart");

  // ── Lead list: call filter toggle and the "who called" line ────────────
  await page.goto("/leads");
  await expect(page.locator("table tbody")).toBeVisible();
  await shot(page, "03-leads");

  await page.getByTestId("call-filter-unanswered").click();
  await shot(page, "04-call-filter");
  await page.getByTestId("call-filter-all").click();

  // ── Bulk assignment ────────────────────────────────────────────────────
  const firstRow = page.locator("tbody tr").first();
  const box = firstRow.locator('input[type="checkbox"]').first();
  if (await box.isVisible().catch(() => false)) {
    await box.check();
    await page.getByTestId("bulk-assign-open").click();
    await shot(page, "05-bulk-assign");
    await page.getByRole("button", { name: "Cancel" }).click();
  }

  // ── Attendance: the punch dialog ───────────────────────────────────────
  // Captured from the dashboard rather than the lead list so the busy table
  // behind it does not fight the dialog in the screenshot.
  await page.goto("/dashboard");
  await settle(page);
  await page.getByTestId("punch-button").click();
  // Wait for the camera preview to have actual frames, not a black rectangle.
  await page.waitForTimeout(1800);
  await shot(page, "06-punch");
  await page
    .getByRole("button", { name: /close/i })
    .click()
    .catch(() => undefined);

  // ── My Performance ─────────────────────────────────────────────────────
  await page.goto("/my-performance");
  await shot(page, "07-my-performance");

  // ── Admin attendance & targets ─────────────────────────────────────────
  await page.goto("/attendance");
  await shot(page, "08-attendance-admin");

  // ── Reports: the daily call activity report ────────────────────────────
  await page.goto("/reports");
  await page
    .getByRole("button", { name: "Call Activity" })
    .click()
    .catch(() => undefined);
  await shot(page, "09-call-activity");

  // ── Settings: document numbering, then message appearance ──────────────
  await page.goto("/settings");
  await page
    .getByText("Document Numbering")
    .scrollIntoViewIfNeeded()
    .catch(() => undefined);
  await shot(page, "10-numbering");

  await page
    .getByText("Message Appearance")
    .scrollIntoViewIfNeeded()
    .catch(() => undefined);
  await shot(page, "11-message-appearance");

  // ── Users: the employment and documents section ────────────────────────
  await page.goto("/users");
  await page
    .getByRole("button", { name: /new user/i })
    .click()
    .catch(() => undefined);
  await page
    .getByText("Employment", { exact: true })
    .scrollIntoViewIfNeeded()
    .catch(() => undefined);
  await shot(page, "12-employee-record");

  const captured = fs.readdirSync(OUT).filter((f) => f.endsWith(".png"));
  // Fail loudly rather than shipping a report full of missing images.
  expect(captured.length).toBeGreaterThanOrEqual(10);
  console.log(`captured ${captured.length} screenshots into ${OUT}`);
});
