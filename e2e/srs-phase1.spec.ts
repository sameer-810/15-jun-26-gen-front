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
 * SRS of 18 Aug 2026 — the three requirements that were not blocked on a client
 * answer.
 *
 * R6  the call outcome is asked for, never assumed
 * R5  bulk lead assignment
 * R10 configurable quotation / proforma / invoice series
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

test.beforeEach(async ({ page }) => {
  await uiLogin(page);
});

test.describe("R6 — the call outcome is asked for, not assumed", () => {
  test("clicking call prompts for the outcome instead of logging 'connected'", async ({ page }) => {
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} CallPrompt` });
    track("leads", lead.id);

    await page.goto("/leads");
    await waitForTable(page);

    await page.getByTestId(`call-${lead.id}`).click();

    // The regression this guards: the old code logged outcome "connected" on
    // click with no prompt at all, so every call read as answered.
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("How did the call go?");
    await expect(page.getByTestId("call-outcome-no_answer")).toBeVisible();
  });

  test("an unanswered call is recorded as unanswered", async ({ page }) => {
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} NoAnswer` });
    track("leads", lead.id);

    await page.goto("/leads");
    await waitForTable(page);

    await page.getByTestId(`call-${lead.id}`).click();
    await page.getByTestId("call-outcome-no_answer").click();
    await expect(page.getByRole("dialog")).toBeHidden();

    // Verify at the source of truth, not the UI: the activity log is what the
    // answered/unanswered report in SRS 3.2 will be built from.
    const res = await ctx.get(`${API}/leads/${lead.id}/workspace`);
    expect(res.ok()).toBeTruthy();
    const timeline = (await res.json()).data.timeline as Array<{
      type: string;
      meta?: { outcome?: string };
    }>;
    const calls = timeline.filter((t) => t.type === "call_logged");
    expect(calls).toHaveLength(1);
    expect(calls[0].meta?.outcome).toBe("no_answer");
  });

  test("dismissing the prompt logs the attempt with no outcome, not a guess", async ({ page }) => {
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} Unsure` });
    track("leads", lead.id);

    await page.goto("/leads");
    await waitForTable(page);

    await page.getByTestId(`call-${lead.id}`).click();
    await page.getByTestId("call-outcome-unknown").click();

    const res = await ctx.get(`${API}/leads/${lead.id}/workspace`);
    const timeline = (await res.json()).data.timeline as Array<{
      type: string;
      meta?: { outcome?: string };
    }>;
    const calls = timeline.filter((t) => t.type === "call_logged");
    expect(calls).toHaveLength(1);
    // The attempt is recorded; the outcome is honestly absent.
    expect(calls[0].meta?.outcome ?? null).toBeNull();
  });
});

test.describe("R5 — bulk lead assignment", () => {
  test("selected leads are reassigned to the chosen user", async ({ page }) => {
    const a = await createLead(ctx, { customerName: `${RUN_TAG} AssignA` });
    const b = await createLead(ctx, { customerName: `${RUN_TAG} AssignB` });
    track("leads", a.id);
    track("leads", b.id);

    await page.goto("/leads");
    await page.getByPlaceholder("Customer, mobile, city, requirement...").fill(`${RUN_TAG} Assign`);
    await waitForTable(page);

    await page.getByTestId(`select-row-${a.id}`).check();
    await page.getByTestId(`select-row-${b.id}`).check();
    await expect(page.getByTestId("bulk-action-bar")).toBeVisible();

    await page.getByTestId("bulk-assign-open").click();

    // Pick the first real person in the list, whoever the seed data gave us.
    const select = page.getByTestId("bulk-assign-select");
    const optionValues = await select
      .locator("option")
      .evaluateAll((els) => els.map((e) => (e as HTMLOptionElement).value).filter(Boolean));
    expect(optionValues.length).toBeGreaterThan(0);
    await select.selectOption(optionValues[0]);
    await page.getByTestId("bulk-assign-confirm").click();

    await expect(page.getByRole("dialog")).toBeHidden();

    const res = await ctx.get(`${API}/leads/${a.id}`);
    const assigned = (await res.json()).data.assignedTo;
    expect(assigned?.id ?? assigned).toBe(optionValues[0]);
  });

  test("live leads can be selected but not deleted", async ({ page }) => {
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} LiveLead` });
    track("leads", lead.id);

    await page.goto("/leads");
    await page
      .getByPlaceholder("Customer, mobile, city, requirement...")
      .fill(`${RUN_TAG} LiveLead`);
    await waitForTable(page);

    await page.getByTestId(`select-row-${lead.id}`).check();

    // Assign is offered; delete is refused up front rather than failing on the
    // server with "0 deleted, 1 skipped".
    await expect(page.getByTestId("bulk-assign-open")).toBeEnabled();
    await expect(page.getByRole("button", { name: /delete selected/i })).toBeDisabled();
  });
});

test.describe("R10 — configurable document series", () => {
  test("Settings edits the quotation series and previews the next number", async ({ page }) => {
    await page.goto("/settings");

    const prefix = page.getByLabel("Quotation prefix");
    await expect(prefix).toBeVisible();

    const original = await prefix.inputValue();
    await prefix.fill("SRFQ");
    await page.getByLabel("Next quotation number").fill("2500");

    // The preview is the feature: it shows what the next document is called.
    await expect(page.getByText("SRFQ-2500")).toBeVisible();

    // Put it back so the suite stays non-destructive.
    await prefix.fill(original || "QTN");
  });

  test("a prefix with a slash is rejected, because it would break the invoice format", async ({
    page,
  }) => {
    await page.goto("/settings");

    const prefix = page.getByLabel("Tax invoice prefix");
    const original = await prefix.inputValue();
    await prefix.fill("IN/V");
    await page.getByRole("button", { name: /save/i }).first().click();

    // The server rejects it; the profile must not silently accept a prefix that
    // would produce INV/V/2026-27/0001 and break GSTR-1 parsing.
    const res = await ctx.get(`${API}/business-profile`);
    const saved = (await res.json()).data.invoicePrefix;
    expect(saved).not.toBe("IN/V");

    await prefix.fill(original || "INV");
  });
});
