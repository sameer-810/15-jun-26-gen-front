import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { ADMIN } from "./helpers";

/**
 * Mobile screenshot capture — every screen at phone size.
 *
 * Not a test: it asserts nothing about correctness. It exists so the before/after
 * the client sees is the real product at the real viewport, not a mock-up.
 *
 * The same file runs twice — once against the current build and once against the
 * rebuilt mobile layer — so the two sets are directly comparable frame for frame.
 * That only holds if the run is deterministic, hence the fixed viewport, forced
 * light theme and the settle() before every shutter.
 *
 *   MOBILE_SHOT_DIR=mobile-before npx playwright test e2e/capture-mobile.spec.ts
 *   MOBILE_SHOT_DIR=mobile-after  npx playwright test e2e/capture-mobile.spec.ts
 */

const DIR = process.env.MOBILE_SHOT_DIR || "mobile-before";
const OUT = path.resolve("report-shots", DIR);

/**
 * iPhone 14 / Pixel 7 class — 390×844 at DPR 3. Chosen because it is the
 * *narrow* end of what field staff actually carry: a layout that survives 390
 * survives everything above it, and the failure this whole exercise is about
 * (an 800px table in a 390px window) is only visible down here.
 */
test.use({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  colorScheme: "light",
});

async function login(page: Page) {
  await page.goto("/login");
  await page.locator("#email").fill(ADMIN.email);
  await page.locator("#password").fill(ADMIN.password);
  await page.getByRole("button", { name: /sign in|log in|login/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(800);
}

async function shot(page: Page, name: string) {
  await settle(page);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
}

/**
 * Measures the actual horizontal overflow at this viewport.
 *
 * This is the number the whole redesign is judged on and it is worth recording
 * rather than eyeballing: `scrollWidth > clientWidth` means the user has to pan
 * sideways to read the screen. Written to a JSON sidecar so the report can state
 * the improvement as a measurement instead of an adjective.
 */
async function overflow(page: Page, route: string) {
  return page.evaluate((r) => {
    const el = document.scrollingElement || document.documentElement;
    const widest = Array.from(document.querySelectorAll<HTMLElement>("main *"))
      .map((n) => n.scrollWidth)
      .reduce((a, b) => Math.max(a, b), 0);
    return {
      route: r,
      viewport: el.clientWidth,
      scrollWidth: el.scrollWidth,
      overflowPx: Math.max(0, el.scrollWidth - el.clientWidth),
      widestChild: widest,
    };
  }, route);
}

/** Routes that render standalone, in the order the report walks through them. */
const ROUTES: Array<{ name: string; path: string }> = [
  { name: "01-dashboard", path: "/dashboard" },
  { name: "02-leads", path: "/leads" },
  { name: "04-quotations", path: "/quotations" },
  { name: "05-sales", path: "/sales" },
  { name: "06-inventory", path: "/inventory" },
  { name: "07-catalog", path: "/catalog" },
  { name: "08-reports", path: "/reports" },
  { name: "09-my-performance", path: "/my-performance" },
  { name: "10-attendance", path: "/attendance" },
  { name: "11-activity", path: "/activity" },
  { name: "12-templates", path: "/templates" },
  { name: "13-locations", path: "/locations" },
  { name: "14-users", path: "/users" },
  { name: "15-settings", path: "/settings" },
  { name: "16-capacity", path: "/capacity-calculator" },
];

test("capture every screen at phone size", async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  const metrics: unknown[] = [];

  // Login is itself one of the screens the client will look at.
  await page.goto("/login");
  await settle(page);
  await page.screenshot({ path: path.join(OUT, "00-login.png") });
  metrics.push(await overflow(page, "/login"));

  await login(page);

  for (const r of ROUTES) {
    await page.goto(r.path);
    await shot(page, r.name);
    metrics.push(await overflow(page, r.path));
  }

  // Lead detail needs a real record, so it is captured by opening the first row
  // of the list rather than by guessing an id.
  await page.goto("/leads");
  await settle(page);
  const firstLead = page.locator('a[href^="/leads/"]').first();
  if (await firstLead.isVisible().catch(() => false)) {
    await firstLead.click();
    await page.waitForURL(/\/leads\/[^/]+$/, { timeout: 15_000 }).catch(() => undefined);
    await shot(page, "03-lead-detail");
    metrics.push(await overflow(page, "/leads/:id"));
  }

  /*
    Navigation — the change the client is reacting to most.

    Before the rebuild this is the hamburger's full-height drawer; after it, the
    bottom bar's More sheet. The selector must be exact rather than a broad
    alternation: a loose /menu|more/i also matches "Account menu" in the top
    bar, and the first capture photographed the account dropdown instead of the
    navigation.
  */
  await page.goto("/dashboard");
  await settle(page);
  const moreTab = page.getByRole("button", { name: "More", exact: true });
  const hamburger = page.getByRole("button", { name: /expand sidebar|collapse sidebar/i });
  const navBtn = (await moreTab.count()) > 0 ? moreTab.first() : hamburger.first();
  if (await navBtn.isVisible().catch(() => false)) {
    await navBtn.click();
    // The sheet opens over where the button was, leaving the cursor hovering a
    // menu row — which photographs as a selected item that isn't selected.
    await page.mouse.move(5, 5);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, "17-navigation.png") });
  }

  fs.writeFileSync(path.join(OUT, "metrics.json"), JSON.stringify(metrics, null, 2));

  const captured = fs.readdirSync(OUT).filter((f) => f.endsWith(".png"));
  // Fail loudly rather than building a report around missing images.
  expect(captured.length).toBeGreaterThanOrEqual(15);
  console.log(`captured ${captured.length} screenshots into ${OUT}`);
  const bad = (metrics as Array<{ route: string; overflowPx: number }>).filter(
    (m) => m.overflowPx > 0,
  );
  console.log(`routes with horizontal overflow: ${bad.length}/${metrics.length}`);
  for (const b of bad) console.log(`  ${b.route}  +${b.overflowPx}px`);
});
