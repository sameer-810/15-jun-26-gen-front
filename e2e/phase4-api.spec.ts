import { test, expect, type APIRequestContext } from "@playwright/test";
import { API, RUN_TAG, adminApi, createLead, sweepRunFixtures } from "./helpers";

/**
 * Change Request Phase 4 — API contract.
 *
 * Point 11 — user-defined labels, notes and reminders on a lead
 * Point 13 — the lead workspace aggregate behind the detail screen
 * Point 14 — the lead's full history
 */

let ctx: APIRequestContext;
const leadIds: string[] = [];
const labelIds: string[] = [];

async function makeLabel(name: string, color = "orange") {
  const res = await ctx.post(`${API}/lead-labels`, { data: { name, color } });
  expect(res.status(), await res.text()).toBe(201);
  const label = (await res.json()).data;
  labelIds.push(label.id);
  return label;
}

test.beforeAll(async () => {
  ({ ctx } = await adminApi());
});

test.afterAll(async () => {
  for (const id of leadIds) await ctx.delete(`${API}/leads/${id}`).catch(() => undefined);
  for (const id of labelIds) await ctx.delete(`${API}/lead-labels/${id}`).catch(() => undefined);
  await sweepRunFixtures(ctx);
  await ctx.dispose();
});

test.describe("Point 11 — user-defined labels", () => {
  test("a label is created, attached to a lead, and comes back on the lead", async () => {
    const label = await makeLabel(`${RUN_TAG} Office Visit`);
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} Labelled` });
    leadIds.push(lead.id);

    const res = await ctx.put(`${API}/leads/${lead.id}/labels`, {
      data: { labelIds: [label.id] },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    const updated = (await res.json()).data;
    expect(updated.labels).toHaveLength(1);
    expect(updated.labels[0]).toMatchObject({ id: label.id, name: label.name, color: "orange" });
  });

  test("label names are unique, case-insensitively", async () => {
    await makeLabel(`${RUN_TAG} Unique Label`);
    const dup = await ctx.post(`${API}/lead-labels`, {
      data: { name: `${RUN_TAG.toLowerCase()} unique label` },
    });
    expect(dup.status()).toBe(409);
    expect((await dup.json()).error.code).toBe("DUPLICATE_LABEL");
  });

  test("the label list reports how many leads carry each one", async () => {
    const label = await makeLabel(`${RUN_TAG} Counted`);
    const a = await createLead(ctx, { customerName: `${RUN_TAG} CountA` });
    const b = await createLead(ctx, { customerName: `${RUN_TAG} CountB` });
    leadIds.push(a.id, b.id);
    for (const lead of [a, b]) {
      await ctx.put(`${API}/leads/${lead.id}/labels`, { data: { labelIds: [label.id] } });
    }

    const res = await ctx.get(`${API}/lead-labels`);
    const found = ((await res.json()).data as Array<{ id: string; leadCount: number }>).find(
      (l) => l.id === label.id,
    );
    expect(found?.leadCount).toBe(2);
  });

  test("deleting a label detaches it from every lead", async () => {
    const label = await makeLabel(`${RUN_TAG} Doomed`);
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} Detach` });
    leadIds.push(lead.id);
    await ctx.put(`${API}/leads/${lead.id}/labels`, { data: { labelIds: [label.id] } });

    const del = await ctx.delete(`${API}/lead-labels/${label.id}`);
    expect(del.ok()).toBeTruthy();

    const after = (await (await ctx.get(`${API}/leads/${lead.id}`)).json()).data;
    expect(after.labels, "label should have been detached").toHaveLength(0);
  });

  test("an unknown label id is rejected rather than silently stored", async () => {
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} BadLabel` });
    leadIds.push(lead.id);
    const res = await ctx.put(`${API}/leads/${lead.id}/labels`, {
      data: { labelIds: ["6a2fd6538697ccd799bea02a"] },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error.code).toBe("UNKNOWN_LABEL");
  });

  test("a sales executive cannot rename or delete a shared label", async () => {
    const login = await ctx.post(`${API}/auth/login`, {
      data: { email: "sales@srfpowermachine.com", password: "Sales@123" },
    });
    test.skip(!login.ok(), "no seeded sales user in this database");
    const salesToken = (await login.json()).data.accessToken;
    const label = await makeLabel(`${RUN_TAG} Protected`);

    const patch = await ctx.patch(`${API}/lead-labels/${label.id}`, {
      headers: { Authorization: `Bearer ${salesToken}` },
      data: { name: "renamed" },
    });
    expect(patch.status()).toBe(403);

    const del = await ctx.delete(`${API}/lead-labels/${label.id}`, {
      headers: { Authorization: `Bearer ${salesToken}` },
    });
    expect(del.status()).toBe(403);
  });
});

test.describe("Point 11 — reminders", () => {
  test("a reminder is created and appears against its lead", async () => {
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} Remind` });
    leadIds.push(lead.id);
    const when = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

    const res = await ctx.post(`${API}/reminders`, {
      data: { lead: lead.id, remindAt: when, note: "Call back about the 125 kVA" },
    });
    expect(res.status(), await res.text()).toBe(201);
    const reminder = (await res.json()).data;
    expect(reminder.status).toBe("pending");
    expect(reminder.isDue).toBe(false);
    expect(reminder.lead.customerName).toBe(`${RUN_TAG} Remind`);

    const list = await ctx.get(`${API}/reminders?leadId=${lead.id}`);
    expect(((await list.json()).data as unknown[]).length).toBe(1);
  });

  test("a past reminder is flagged as due", async () => {
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} Overdue` });
    leadIds.push(lead.id);
    const res = await ctx.post(`${API}/reminders`, {
      data: { lead: lead.id, remindAt: new Date(Date.now() - 60_000).toISOString() },
    });
    expect((await res.json()).data.isDue).toBe(true);
  });

  test("setting a reminder pulls the lead's next follow-up date forward", async () => {
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} FollowUpSync` });
    leadIds.push(lead.id);
    const soon = new Date(Date.now() + 60 * 60 * 1000);

    await ctx.post(`${API}/reminders`, {
      data: { lead: lead.id, remindAt: soon.toISOString() },
    });
    const after = (await (await ctx.get(`${API}/leads/${lead.id}`)).json()).data;
    expect(after.nextFollowUpDate).toBeTruthy();
    expect(new Date(after.nextFollowUpDate).getTime()).toBe(soon.getTime());
  });

  test("completing a reminder stamps it and drops it from the pending list", async () => {
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} Complete` });
    leadIds.push(lead.id);
    const created = await ctx.post(`${API}/reminders`, {
      data: { lead: lead.id, remindAt: new Date(Date.now() + 3600_000).toISOString() },
    });
    const id = (await created.json()).data.id;

    const done = await ctx.patch(`${API}/reminders/${id}/status`, { data: { status: "done" } });
    expect(done.ok()).toBeTruthy();
    const body = (await done.json()).data;
    expect(body.status).toBe("done");
    expect(body.completedAt).toBeTruthy();

    const pending = await ctx.get(`${API}/reminders?leadId=${lead.id}&status=pending`);
    expect(((await pending.json()).data as unknown[]).length).toBe(0);
  });

  test("deleting a lead takes its reminders with it", async () => {
    // Otherwise the dashboard keeps listing reminders for a lead that has left
    // the pipeline, with no way to clear them.
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} Cascade` });
    await ctx.post(`${API}/reminders`, {
      data: { lead: lead.id, remindAt: new Date(Date.now() - 60_000).toISOString() },
    });

    const before = await ctx.get(`${API}/reminders?leadId=${lead.id}`);
    expect(((await before.json()).data as unknown[]).length).toBe(1);

    expect((await ctx.delete(`${API}/leads/${lead.id}`)).ok()).toBeTruthy();

    const after = await ctx.get(`${API}/reminders?leadId=${lead.id}`);
    expect(((await after.json()).data as unknown[]).length).toBe(0);
  });

  test("a reminder on an unreachable lead is refused", async () => {
    const res = await ctx.post(`${API}/reminders`, {
      data: { lead: "6a2fd6538697ccd799bea02a", remindAt: new Date().toISOString() },
    });
    expect(res.status()).toBe(404);
  });
});

test.describe("Point 13/14 — the lead workspace", () => {
  test("returns the lead, engagement counters, timeline, reminders and documents", async () => {
    const label = await makeLabel(`${RUN_TAG} WS`);
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} Workspace` });
    leadIds.push(lead.id);

    await ctx.put(`${API}/leads/${lead.id}/labels`, { data: { labelIds: [label.id] } });
    await ctx.post(`${API}/leads/${lead.id}/calls`, {
      data: { outcome: "connected", note: "Discussed the 125 kVA" },
    });
    await ctx.post(`${API}/leads/${lead.id}/follow-ups`, { data: { note: "Sending a quote" } });
    await ctx.post(`${API}/reminders`, {
      data: { lead: lead.id, remindAt: new Date(Date.now() + 3600_000).toISOString() },
    });
    await ctx.post(`${API}/quotations`, {
      data: {
        docType: "quotation",
        lead: lead.id,
        customerName: `${RUN_TAG} Workspace`,
        items: [{ description: "125 kVA genset", quantity: 1, unitPrice: 950000, taxRate: 18 }],
      },
    });

    const res = await ctx.get(`${API}/leads/${lead.id}/workspace`);
    expect(res.ok(), await res.text()).toBeTruthy();
    const ws = (await res.json()).data;

    expect(ws.lead.labels).toHaveLength(1);
    expect(ws.engagement.calls).toBe(1);
    expect(ws.engagement.followUps).toBe(1);
    // One enquiry + one quote raised from it.
    expect(ws.engagement.requirements).toBe(2);
    expect(ws.engagement.quotations).toBe(1);
    expect(ws.reminders).toHaveLength(1);
    expect(ws.quotations).toHaveLength(1);

    // Point 14 — the full history, newest first.
    const types = (ws.timeline as Array<{ type: string }>).map((t) => t.type);
    expect(types).toContain("lead_created");
    expect(types).toContain("lead_labelled");
    expect(types).toContain("call_logged");
    expect(types).toContain("follow_up_added");
    expect(types).toContain("reminder_set");
  });

  test("logging a call moves a new lead to contacted", async () => {
    const lead = await createLead(ctx, { customerName: `${RUN_TAG} CallStatus`, status: "new" });
    leadIds.push(lead.id);
    const res = await ctx.post(`${API}/leads/${lead.id}/calls`, {
      data: { outcome: "no_answer" },
    });
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).data.status).toBe("contacted");
  });

  test("logging a call does not disturb a lead further down the pipeline", async () => {
    const lead = await createLead(ctx, {
      customerName: `${RUN_TAG} CallKeepStatus`,
      status: "negotiation",
    });
    leadIds.push(lead.id);
    await ctx.post(`${API}/leads/${lead.id}/calls`, { data: { outcome: "connected" } });
    const after = (await (await ctx.get(`${API}/leads/${lead.id}`)).json()).data;
    expect(after.status).toBe("negotiation");
  });

  test("the workspace 404s for a lead that does not exist", async () => {
    const res = await ctx.get(`${API}/leads/6a2fd6538697ccd799bea02a/workspace`);
    expect(res.status()).toBe(404);
  });
});

test.describe("Dashboard surfaces due reminders", () => {
  test("remindersDue counts my pending, overdue reminders", async () => {
    const before = (await (await ctx.get(`${API}/dashboard`)).json()).data.remindersDue;
    expect(typeof before).toBe("number");

    const lead = await createLead(ctx, { customerName: `${RUN_TAG} DashRemind` });
    leadIds.push(lead.id);
    await ctx.post(`${API}/reminders`, {
      data: { lead: lead.id, remindAt: new Date(Date.now() - 60_000).toISOString() },
    });

    const after = (await (await ctx.get(`${API}/dashboard`)).json()).data.remindersDue;
    expect(after).toBe(before + 1);
  });
});
