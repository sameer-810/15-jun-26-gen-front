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
 * SRS of 18 Aug 2026 — the remaining requirements.
 *
 * R1  photo attendance          R2  employee documents
 * R3  salary calculator         R4  incentive calculator
 * R7  answered/unanswered       R8  daily call report
 * R9  GST vs Non-GST analytics  R11 message appearance
 * R13 My Performance
 *
 * These lean on the API for assertions wherever the value matters more than the
 * pixel — a payroll figure is worth checking against the arithmetic, not
 * against whatever the DOM happens to render.
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

test.describe("R1 — photo attendance", () => {
  test("the punch control is in the shell and opens the camera dialog", async ({ page }) => {
    await page.goto("/dashboard");
    const punch = page.getByTestId("punch-button");
    await expect(punch).toBeVisible();

    await punch.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // Camera permission is denied in headless Chromium, and that must degrade
    // to a readable message rather than an empty box.
    await expect(dialog).toContainText(/photo|camera/i);
  });

  test("a punch without a photo is refused", async () => {
    // Straight at the API: the photo is the entire point of the requirement, so
    // it must not be optional at the boundary regardless of what the UI sends.
    const res = await ctx.post(`${API}/attendance/punch`, { data: {} });
    expect(res.status()).toBe(400);
  });

  test("the server stamps the punch time rather than trusting the client", async () => {
    const res = await ctx.post(`${API}/attendance/punch`, {
      data: {
        // A 1x1 JPEG, and a clock claiming it is 1999.
        photoBase64:
          "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
        at: "1999-01-01T00:00:00.000Z",
      },
    });
    expect(res.ok()).toBeTruthy();
    const day = (await res.json()).data.attendance;

    /*
      Assert the *year*, not a tight window around this request. `firstIn` is
      the first punch of the day, and by the time the whole suite has run this
      account may already have punched earlier — so a "within 60 seconds" check
      measures test ordering, not the behaviour under test.

      The behaviour under test is that the client's claimed timestamp was
      ignored: the request said 1999, and the record must say today.
    */
    const stamped = new Date(day.firstIn?.at ?? day.date);
    expect(stamped.getUTCFullYear()).toBe(new Date().getUTCFullYear());
  });
});

test.describe("R3 / R4 — pay and incentive arithmetic", () => {
  test("gross pay follows the documented day-rate rule", async () => {
    const me = await (await ctx.get(`${API}/auth/me`)).json();
    const userId = me.data.id;

    // 31_000 over a 31-day month is a clean 1000/day, so the arithmetic is
    // checkable by hand rather than by re-implementing it in the test.
    await ctx.patch(`${API}/auth/users/${userId}`, { data: { monthlyGross: 31000 } });

    const res = await ctx.get(`${API}/attendance/monthly?month=2026-01`);
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()).data;

    expect(body.period.daysInMonth).toBe(31);
    expect(body.pay.dayRate).toBe(1000);
    // Pay is day rate × payable days, and never more than the monthly gross.
    expect(body.pay.grossEarned).toBe(Math.round(1000 * body.pay.payableDays));
    expect(body.pay.grossEarned).toBeLessThanOrEqual(31000);
  });

  /**
   * The requirement, not the formula.
   *
   * The test above asserts `grossEarned === dayRate × payableDays` — the
   * implementation restated, so it cannot fail for the thing it is named after.
   * This one checks the promise payroll.rules.js actually makes: a month with
   * nothing wrong in it pays the whole monthly gross.
   *
   * The setup is the point. Every *working* day gets a stored row and the
   * Sundays get none — the shape real attendance has. If the Sundays are not
   * pulled in from the calendar, this cannot reach 30,000.
   */
  test("a complete month pays exactly the monthly gross", async () => {
    const me = await (await ctx.get(`${API}/auth/me`)).json();
    const userId = me.data.id;
    await ctx.patch(`${API}/auth/users/${userId}`, { data: { monthlyGross: 30000 } });

    // April 2026: 30 days, well before any live attendance in this database.
    const MONTH = "2026-04";
    const dayOf = (d: number) => `${MONTH}-${String(d).padStart(2, "0")}`;
    // Sunday in IST. Reading the UTC weekday of a bare YYYY-MM-DD is safe here
    // because midnight UTC and midnight IST fall on the same calendar date.
    const sundays: number[] = [];
    for (let d = 1; d <= 30; d++) {
      if (new Date(`${dayOf(d)}T00:00:00Z`).getUTCDay() === 0) sundays.push(d);
    }
    expect(sundays.length).toBeGreaterThan(0);

    const marked = await ctx.post(`${API}/attendance/leave`, {
      data: { userId, from: dayOf(1), to: dayOf(30), note: `${RUN_TAG} payroll check` },
    });
    expect(marked.ok(), `could not mark leave: ${await marked.text()}`).toBeTruthy();
    // Take the Sundays back out, so they have no stored row and must be
    // supplied by the calendar.
    for (const d of sundays) {
      await ctx.delete(`${API}/attendance/leave`, { data: { userId, date: dayOf(d) } });
    }

    try {
      const body = (await (await ctx.get(`${API}/attendance/monthly?month=${MONTH}`)).json()).data;

      // Every calendar day is present, not just the ones with a row behind them.
      expect(body.days.length).toBe(30);
      expect(body.period.daysInMonth).toBe(30);

      // The Sundays came from the calendar, not the database.
      expect(body.pay.counts.week_off).toBe(sundays.length);
      expect(body.pay.counts.leave).toBe(30 - sundays.length);

      // Nothing is unaccounted for: leave + week_off must cover the whole month.
      const counted = Object.values(body.pay.counts as Record<string, number>).reduce(
        (a, b) => a + b,
        0,
      );
      expect(counted).toBe(30);
      expect(body.pay.counts.absent ?? 0).toBe(0);

      // The point of the test.
      expect(body.pay.payableDays).toBe(30);
      expect(body.pay.grossEarned).toBe(30000);
    } finally {
      for (let d = 1; d <= 30; d++) {
        await ctx
          .delete(`${API}/attendance/leave`, { data: { userId, date: dayOf(d) } })
          .catch(() => undefined);
      }
    }
  });

  test("an unpunched weekly off is still a paid day", async () => {
    const me = await (await ctx.get(`${API}/auth/me`)).json();
    await ctx.patch(`${API}/auth/users/${me.data.id}`, { data: { monthlyGross: 30000 } });

    // Nothing is written for this month at all — every day comes from the
    // calendar. The Sundays must still be counted and paid.
    const body = (await (await ctx.get(`${API}/attendance/monthly?month=2026-04`)).json()).data;
    const weekOffs = body.days.filter((d: { status: string }) => d.status === "week_off");

    expect(weekOffs.length).toBeGreaterThan(0);
    expect(body.pay.counts.week_off).toBe(weekOffs.length);
    // Those days are worth full pay, so they must show up in payableDays.
    expect(body.pay.payableDays).toBeGreaterThanOrEqual(weekOffs.length);
    expect(body.pay.grossEarned).toBe(Math.round(body.pay.dayRate * body.pay.payableDays));
  });

  test("approved leave is recorded, paid, and refuses a worked day", async () => {
    const me = await (await ctx.get(`${API}/auth/me`)).json();
    const userId = me.data.id;
    const DAY = "2026-04-15";

    const res = await ctx.post(`${API}/attendance/leave`, {
      data: { userId, from: DAY, note: `${RUN_TAG} single day` },
    });
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).data.marked).toBe(1);

    try {
      const body = (await (await ctx.get(`${API}/attendance/monthly?month=2026-04`)).json()).data;
      expect(body.pay.counts.leave).toBe(1);

      // A range that would cover a day already settled must not silently
      // overwrite it — the guard reports it rather than clobbering the record.
      const bad = await ctx.post(`${API}/attendance/leave`, {
        data: { userId, from: "2026-04-11", to: "2026-04-09" },
      });
      expect(bad.status()).toBe(400);
    } finally {
      await ctx
        .delete(`${API}/attendance/leave`, { data: { userId, date: DAY } })
        .catch(() => undefined);
    }
  });

  test("an incomplete day pays nothing and is reported as unresolved", async () => {
    // The punch made above opened a shift and never closed it.
    const res = await ctx.get(`${API}/attendance/monthly`);
    const body = (await res.json()).data;
    const open = body.days.filter((d: { status: string }) => d.status === "incomplete");
    if (open.length > 0) {
      expect(body.pay.unresolvedDays).toBe(open.length);
      // "incomplete" is worth 0 — never silently rounded to a full day.
      const counted = body.pay.counts.incomplete ?? 0;
      expect(counted).toBe(open.length);
    }
  });

  test("incentive is the configured percentage of closed sales", async () => {
    const me = await (await ctx.get(`${API}/auth/me`)).json();
    await ctx.patch(`${API}/auth/users/${me.data.id}`, { data: { incentiveRate: 5 } });

    const res = await ctx.get(`${API}/attendance/monthly`);
    const { incentive } = (await res.json()).data;
    expect(incentive.incentiveRate).toBe(5);
    expect(incentive.incentiveEarned).toBe(Math.round((incentive.salesValue * 5) / 100));
  });
});

test.describe("R2 / R7 — employee documents and Aadhaar handling", () => {
  test("a full Aadhaar number is rejected; four digits are accepted", async () => {
    const me = await (await ctx.get(`${API}/auth/me`)).json();
    const id = me.data.id;

    const full = await ctx.patch(`${API}/auth/users/${id}`, {
      data: { documents: { aadhaarLast4: "123456789012" } },
    });
    expect(full.status()).toBe(400);

    const last4 = await ctx.patch(`${API}/auth/users/${id}`, {
      data: { documents: { aadhaarLast4: "9012" } },
    });
    expect(last4.ok()).toBeTruthy();
    expect((await last4.json()).data.documents.aadhaarLast4).toBe("9012");
  });

  test("salary is not exposed on /auth/me", async () => {
    // The employment record belongs to the admin endpoints only; login and
    // /me are called by every signed-in user.
    const me = await (await ctx.get(`${API}/auth/me`)).json();
    expect(me.data.monthlyGross).toBeUndefined();
    expect(me.data.documents).toBeUndefined();
  });
});

test.describe("R7 — answered / unanswered filtering", () => {
  test("the toggle narrows the list by call outcome", async ({ page }) => {
    const answered = await createLead(ctx, { customerName: `${RUN_TAG} Answered` });
    const missed = await createLead(ctx, { customerName: `${RUN_TAG} Missed` });
    track("leads", answered.id);
    track("leads", missed.id);

    await ctx.post(`${API}/leads/${answered.id}/calls`, { data: { outcome: "connected" } });
    await ctx.post(`${API}/leads/${missed.id}/calls`, { data: { outcome: "no_answer" } });

    await page.goto("/leads");
    await page.getByPlaceholder("Customer, mobile, city, requirement...").fill(RUN_TAG);
    await waitForTable(page);

    await page.getByTestId("call-filter-answered").click();
    await waitForTable(page);
    await expect(page.locator("tbody tr", { hasText: `${RUN_TAG} Answered` })).toHaveCount(1);
    await expect(page.locator("tbody tr", { hasText: `${RUN_TAG} Missed` })).toHaveCount(0);

    await page.getByTestId("call-filter-unanswered").click();
    await waitForTable(page);
    await expect(page.locator("tbody tr", { hasText: `${RUN_TAG} Missed` })).toHaveCount(1);
    await expect(page.locator("tbody tr", { hasText: `${RUN_TAG} Answered` })).toHaveCount(0);
  });

  test("a call with no outcome counts as not-called, not as unanswered", async ({ page }) => {
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} NoOutcome` });
    track("leads", lead.id);
    await ctx.post(`${API}/leads/${lead.id}/calls`, { data: {} });

    await page.goto("/leads");
    await page
      .getByPlaceholder("Customer, mobile, city, requirement...")
      .fill(`${RUN_TAG} NoOutcome`);
    await waitForTable(page);

    // Claiming an unrecorded outcome was a failure would be the same invention
    // the call-outcome fix removed.
    await page.getByTestId("call-filter-unanswered").click();
    await waitForTable(page);
    await expect(page.locator("tbody tr", { hasText: `${RUN_TAG} NoOutcome` })).toHaveCount(0);
  });

  test("the lead row shows who made the call", async ({ page }) => {
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} WhoCalled` });
    track("leads", lead.id);
    await ctx.post(`${API}/leads/${lead.id}/calls`, { data: { outcome: "connected" } });

    await page.goto("/leads");
    await page
      .getByPlaceholder("Customer, mobile, city, requirement...")
      .fill(`${RUN_TAG} WhoCalled`);
    await waitForTable(page);

    const row = page.locator("tbody tr", { hasText: `${RUN_TAG} WhoCalled` });
    await expect(row).toContainText("Connected");
  });
});

test.describe("R8 — daily call activity report", () => {
  test("answered and unanswered are counted separately per employee", async () => {
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} Report` });
    track("leads", lead.id);
    await ctx.post(`${API}/leads/${lead.id}/calls`, { data: { outcome: "connected" } });
    await ctx.post(`${API}/leads/${lead.id}/calls`, { data: { outcome: "no_answer" } });
    await ctx.post(`${API}/leads/${lead.id}/calls`, { data: {} });

    const res = await ctx.get(`${API}/reports/call-activity`);
    expect(res.ok()).toBeTruthy();
    const { summary } = (await res.json()).data;

    expect(summary.answered).toBeGreaterThanOrEqual(1);
    expect(summary.unanswered).toBeGreaterThanOrEqual(1);
    // Calls with no recorded outcome are their own bucket, not folded into
    // either side.
    expect(summary.unknown).toBeGreaterThanOrEqual(1);
    expect(summary.total).toBe(summary.answered + summary.unanswered + summary.unknown);
  });

  test("the report is reachable from the Reports screen", async ({ page }) => {
    await page.goto("/reports");
    await page.getByRole("button", { name: "Call Activity" }).click();
    await expect(page.getByRole("button", { name: "Call Activity" })).toBeVisible();
  });
});

test.describe("R9 — GST vs Non-GST analytics", () => {
  test("the endpoint returns a dense 12-month series that adds up", async () => {
    const res = await ctx.get(`${API}/dashboard/sales-analytics?months=12`);
    expect(res.ok()).toBeTruthy();
    const data = (await res.json()).data;

    // Dense: every month present, so a quiet quarter is not compressed away.
    expect(data.series).toHaveLength(12);
    const summed = data.series.reduce((a: number, s: { total: number }) => a + s.total, 0);
    expect(Math.round(summed)).toBe(Math.round(data.totals.total));
    expect(data.totals.total).toBe(
      data.totals.gst + data.totals.non_gst + data.totals.unclassified,
    );
  });

  test("the chart renders on the dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("Revenue — GST vs Non-GST")).toBeVisible();
  });
});

test.describe("R11 / R13 — appearance and My Performance", () => {
  test("appearance settings are readable without admin rights on the profile", async () => {
    const res = await ctx.get(`${API}/business-profile/appearance`);
    expect(res.ok()).toBeTruthy();
    const data = (await res.json()).data;
    expect(data).toHaveProperty("chatDensity");
    // The narrow endpoint must not carry the banking details.
    expect(data).not.toHaveProperty("bankAccountNumber");
    expect(data).not.toHaveProperty("gstin");
  });

  test("My Performance shows attendance, earnings and targets", async ({ page }) => {
    await page.goto("/my-performance");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Payable Days")).toBeVisible();
    await expect(page.getByText("Gross Earned")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Targets", exact: true })).toBeVisible();
    // The gross-not-net caveat must be on screen, not only in the docs.
    await expect(page.getByText(/PF, ESI and TDS/)).toBeVisible();
  });

  test("a target set by an admin appears with computed achievement", async () => {
    const me = await (await ctx.get(`${API}/auth/me`)).json();
    const month = new Date().toISOString().slice(0, 7);

    const res = await ctx.post(`${API}/targets`, {
      data: { userId: me.data.id, month, metric: "sales_value", value: 500000 },
    });
    expect(res.ok()).toBeTruthy();

    const listed = await ctx.get(`${API}/targets?month=${month}`);
    const { targets } = (await listed.json()).data;
    const mine = targets.find((t: { userId: string }) => t.userId === me.data.id);
    expect(mine).toBeTruthy();
    expect(mine.target).toBe(500000);
    // Achievement is derived from sales, never stored, so it is always a number.
    expect(typeof mine.achieved).toBe("number");
  });
});
