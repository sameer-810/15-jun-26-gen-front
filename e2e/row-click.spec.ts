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
 * Whole-row click opens the record.
 *
 * The happy path is the least interesting test here. Row-click is easy to add
 * and easy to get wrong, and the ways it goes wrong are all about what it must
 * *not* do: swallow a button press, or hijack a text selection when someone is
 * copying a mobile number out of the table. Those guards are what these tests
 * are actually protecting.
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

test.describe("Lead list — clicking the row opens the lead", () => {
  test("a click on non-interactive space in the row navigates to the detail page", async ({
    page,
  }) => {
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} RowClick` });
    track("leads", lead.id);

    await page.goto("/leads");
    await waitForTable(page);

    const row = page.locator("tbody tr", { hasText: `${RUN_TAG} RowClick` });
    await expect(row).toHaveCount(1);

    // Target the Location cell by its text rather than a column index: the
    // table has a selection checkbox in front and the column order is exactly
    // the kind of thing that gets rearranged later.
    await row.getByText(`${RUN_TAG}TOWN`).click();

    await expect(page).toHaveURL(new RegExp(`/leads/${lead.id}$`));
  });

  test("the customer name still works as an ordinary link", async ({ page }) => {
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} StillALink` });
    track("leads", lead.id);

    await page.goto("/leads");
    await waitForTable(page);

    // Keyboard and screen-reader users depend on this being a real anchor, so
    // the row handler must not have replaced it.
    const link = page.getByTestId(`open-lead-${lead.id}`);
    await expect(link).toHaveAttribute("href", `/leads/${lead.id}`);

    await link.click();
    await expect(page).toHaveURL(new RegExp(`/leads/${lead.id}$`));
  });

  test("clicking a row action button does not also open the lead", async ({ page }) => {
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} ActionGuard` });
    track("leads", lead.id);

    await page.goto("/leads");
    await waitForTable(page);

    const row = page.locator("tbody tr", { hasText: `${RUN_TAG} ActionGuard` });
    // The WhatsApp action opens a dialog. If the row handler leaked, we would
    // land on the detail page instead and the dialog would never appear.
    await row
      .getByRole("button", { name: /whatsapp/i })
      .first()
      .click();

    await expect(page).toHaveURL(/\/leads$/);
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("selecting text in a cell does not navigate away", async ({ page }) => {
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} CopyGuard` });
    track("leads", lead.id);

    await page.goto("/leads");
    await waitForTable(page);

    const row = page.locator("tbody tr", { hasText: `${RUN_TAG} CopyGuard` });
    // Plain text, deliberately: dragging across a cell that contains an anchor
    // would be testing the browser's link behaviour rather than our guard.
    const cell = row.getByText(`${RUN_TAG}TOWN`);
    const box = await cell.boundingBox();
    if (!box) throw new Error("expected the location cell to be visible");

    // Drag across the cell the way someone copying a phone number would. The
    // click event fires on mouseup at the end of this gesture, which is exactly
    // the case the selection guard exists to swallow.
    await page.mouse.move(box.x + 6, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 6, box.y + box.height / 2, { steps: 12 });
    await page.mouse.up();

    await expect(page).toHaveURL(/\/leads$/);
  });
});
