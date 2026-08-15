import { expect, request, type APIRequestContext, type Page } from "@playwright/test";

export const API = process.env.E2E_API_URL || "http://localhost:5003/api";

export const ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL || "admin@srfpowermachine.com",
  password: process.env.E2E_ADMIN_PASSWORD || "Admin@123",
};

/**
 * A tag stamped into every record these tests create, so fixtures are easy to
 * find, filter on, and delete — and impossible to confuse with real data.
 */
export const RUN_TAG = `E2E${Date.now().toString(36).toUpperCase()}`;

/** Log in through the API and return the bearer token. */
export async function apiLogin(ctx: APIRequestContext): Promise<string> {
  const res = await ctx.post(`${API}/auth/login`, { data: ADMIN });
  expect(res.ok(), `login failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  const body = await res.json();
  const token = body?.data?.accessToken ?? body?.data?.token;
  expect(token, `no token in login response: ${JSON.stringify(body)}`).toBeTruthy();
  return token as string;
}

/** A standalone API context already carrying the admin bearer token. */
export async function adminApi(): Promise<{ ctx: APIRequestContext; token: string }> {
  const bare = await request.newContext();
  const token = await apiLogin(bare);
  await bare.dispose();
  // Only the Authorization header is global. Setting Content-Type here would
  // override the multipart boundary Playwright generates for file uploads —
  // it already sets application/json for `data` and multipart for `multipart`.
  const ctx = await request.newContext({
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
  return { ctx, token };
}

/**
 * Log in through the UI. Uses the real form rather than seeding localStorage so
 * the auth flow itself stays covered.
 */
export async function uiLogin(page: Page) {
  await page.goto("/login");
  // Keyed on the field ids, not the placeholder. This helper runs in every
  // spec, and it silently took the whole suite down when the login page was
  // rebuilt and the placeholder changed from "you@company.com" to
  // "you@srfpowermachine.com" — a copy edit should never be able to do that.
  // The password field's `type` flips to "text" behind the show/hide toggle,
  // so that is not a safe selector either.
  await page.locator("#email").fill(ADMIN.email);
  await page.locator("#password").fill(ADMIN.password);
  await page.getByRole("button", { name: /sign in|log in|login/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

/** Wait for the resource table to finish its loading spinner. */
export async function waitForTable(page: Page) {
  await expect(page.locator("table tbody")).toBeVisible();
  await expect(page.locator("table tbody .animate-spin")).toHaveCount(0, { timeout: 30_000 });
}

export type CreatedLead = { id: string; customerName: string };

/** Create a lead over the API. Returns its id so the test can clean up. */
export async function createLead(
  ctx: APIRequestContext,
  overrides: Record<string, unknown> = {},
): Promise<CreatedLead> {
  const payload = {
    customerName: `${RUN_TAG} Lead`,
    mobile: "9876500001",
    email: `${RUN_TAG.toLowerCase()}@e2e.test`,
    city: `${RUN_TAG}TOWN`,
    state: "Maharashtra",
    requirement: "62.5 kVA silent diesel genset for cold storage",
    requiredKva: 62.5,
    quantity: 3,
    estimatedValue: 450000,
    source: "walk_in",
    status: "new",
    ...overrides,
  };
  const res = await ctx.post(`${API}/leads`, { data: payload });
  expect(res.status(), `createLead failed: ${await res.text()}`).toBe(201);
  const body = await res.json();
  return { id: body.data.id, customerName: body.data.customerName };
}

/** Best-effort cleanup — a failed delete must not fail the test run. */
export async function deleteLeads(ctx: APIRequestContext, ids: string[]) {
  for (const id of ids) {
    await ctx.delete(`${API}/leads/${id}`).catch(() => undefined);
  }
}

/**
 * Sweep every record this run tagged, by searching for RUN_TAG rather than
 * relying on ids the test collected. A test that fails part-way never reaches
 * its `push`, so id-tracking alone leaves fixtures behind in a live database.
 */
export async function sweepRunFixtures(ctx: APIRequestContext) {
  for (const resource of ["products", "media", "leads"] as const) {
    const res = await ctx.get(`${API}/${resource}?search=${RUN_TAG}&limit=200`).catch(() => null);
    if (!res?.ok()) continue;
    const items = (await res.json().catch(() => ({ data: [] }))).data as Array<{ id: string }>;
    for (const item of items) {
      await ctx.delete(`${API}/${resource}/${item.id}`).catch(() => undefined);
    }
  }
}
