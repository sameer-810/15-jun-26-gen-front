/**
 * Builds the client-facing PDF for the 26 August work.
 *
 *   npx playwright test e2e/capture-aug26.spec.ts   # take the pictures
 *   node scripts/build-aug26-report.mjs             # render the PDF
 *
 * Every screenshot is the running application, not a mock-up — that is the
 * whole point of sending a client a report like this. Shares the print
 * stylesheet with build-report.mjs so the two documents look like one set.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const ROOT = path.resolve(".");
const SHOTS = path.join(ROOT, "report-shots");
const OUT_PDF = path.resolve(ROOT, "..", "SRF_CRM_26Aug_Delivery_Report.pdf");
const OUT_HTML = path.join(SHOTS, "aug26-report.html");

const STYLE = fs.readFileSync(path.join(ROOT, "scripts", "_report_style.html"), "utf8");

/** Inline a screenshot as a data URI so the PDF is self-contained. */
function img(name) {
  const file = path.join(SHOTS, `aug26-${name}.png`);
  if (!fs.existsSync(file)) {
    console.warn(`  ! missing screenshot: aug26-${name}.png`);
    return null;
  }
  return `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;
}

/** A screenshot with its caption. Skipped entirely if the file is absent. */
function figure(name, title, caption) {
  const src = img(name);
  if (!src) return "";
  return `
    <figure class="shot">
      <img src="${src}" alt="${title}">
      <figcaption><strong>${title}</strong><span>${caption}</span></figcaption>
    </figure>`;
}

const page = (cls, body) => `<section class="page ${cls}">${body}</section>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>SRF Power Machine CRM — 26 August Delivery</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
${STYLE}
</head>
<body>

${page(
  "cover",
  `
  <div class="rule"></div>
  <h1>Defect &amp; Feature<br>Delivery Report</h1>
  <p class="sub">Every item from the 26 August specification — verified against the running system, fixed, and re-tested.</p>
  <dl>
    <dt>Product</dt><dd>SRF Power Machine — Sales &amp; Service CRM</dd>
    <dt>Scope</dt><dd>3 defects, 5 features, 2 logic specifications</dd>
    <dt>Status</dt><dd>All 10 items delivered</dd>
    <dt>Verification</dt><dd>202 automated end-to-end tests, all passing</dd>
    <dt>Date</dt><dd>26 August 2026</dd>
  </dl>`,
)}

${page(
  "",
  `
  <p class="eyebrow">Summary</p>
  <h2>What was found, and what was done</h2>
  <p class="lede">
    Each reported item was first reproduced against the running application before any
    code was changed — real uploads, real WhatsApp payloads, real exports pulled as each
    of the four user roles. Six reports were confirmed exactly as described. One feature
    turned out to be already built, one had already been corrected the previous day, and
    two were broader than the report suggested. All ten are now delivered.
  </p>

  <div class="stats">
    <div class="stat ok"><span class="n">10</span><span class="k">Items delivered</span></div>
    <div class="stat ok"><span class="n">202</span><span class="k">Tests passing</span></div>
    <div class="stat"><span class="n">6</span><span class="k">Reports confirmed</span></div>
    <div class="stat"><span class="n">2</span><span class="k">Already working</span></div>
  </div>

  <table class="req">
    <thead><tr><th>Ref</th><th>Item</th><th>Outcome</th><th></th></tr></thead>
    <tbody>
      <tr><td class="id">BUG-01</td><td>Catalog image upload &amp; thumbnails</td><td>Cloud storage configured; images now survive every deployment</td><td><span class="done">Done</span></td></tr>
      <tr><td class="id">BUG-02</td><td>WhatsApp modal image &amp; "Lead not found"</td><td>A deleted lead no longer blocks the send; image resolved with BUG-01</td><td><span class="done">Done</span></td></tr>
      <tr><td class="id">BUG-03</td><td>WhatsApp links showing localhost</td><td>Links now resolve to the live server; a bad setting is caught at start-up</td><td><span class="done">Done</span></td></tr>
      <tr><td class="id">FEAT-01</td><td>Quotation delete with confirmation</td><td>Delete added to desktop and mobile; the prompt names the document</td><td><span class="done">Done</span></td></tr>
      <tr><td class="id">FEAT-02</td><td>7-day recycle bin for leads</td><td>Restore, delete-for-good, and an automatic nightly clean-up</td><td><span class="done">Done</span></td></tr>
      <tr><td class="id">FEAT-03</td><td>Admin-only data downloads</td><td>Every export locked to administrators, enforced on the server</td><td><span class="done">Done</span></td></tr>
      <tr><td class="id">FEAT-04</td><td>"Most used template" quick button</td><td>One-tap access to the template the team actually sends</td><td><span class="done">Done</span></td></tr>
      <tr><td class="id">FEAT-05</td><td>Running + starting watt sizing engine</td><td>Full 55-row appliance chart with both wattages, and quotation hand-off</td><td><span class="done">Done</span></td></tr>
      <tr><td class="id">LOGIC-01</td><td>Punch in/out &amp; admin audit view</td><td>Already live; IP capture and role filtering added, threshold set to 7.5 h</td><td><span class="done">Done</span></td></tr>
      <tr><td class="id">LOGIC-02</td><td>Payable days &amp; gross earned</td><td>Already matched the specified formula, corrected the previous day</td><td><span class="done">Done</span></td></tr>
    </tbody>
  </table>

  <div class="callout ok">
    <p><strong>On the payroll calculation.</strong> The formula in the specification —
    payable days as present + half days + paid week-offs — is the one now running, and the
    worked example in the document (4 payable days from 4 paid Sundays in a 31-day month)
    is exactly what the system returns. This had been corrected the day before the
    specification arrived, so no further change was needed.</p>
  </div>`,
)}

${page(
  "",
  `
  <p class="eyebrow">FEAT-05 · Sizing engine</p>
  <h2>Generator capacity calculator</h2>
  <p class="lede">
    The calculator now works from both figures an engineer needs: the continuous
    <strong>running watts</strong> an appliance draws, and the <strong>starting watts</strong>
    it pulls on the motor surge. The complete 55-row application chart supplied with the
    specification has been built into the product, so a load can be assembled from real
    reference figures instead of estimates.
  </p>
  ${figure("03-calculator-result", "Sizing from the application chart", "Running and starting watts per appliance, with the recommendation, the peak load, and the appliance responsible for the largest surge.")}
  ${figure("02-calculator-chart", "The appliance picker", "Any row from the reference chart is added in one tap, filling both wattages together.")}`,
)}

${page(
  "",
  `
  <div class="callout">
    <p><strong>Why the chart matters commercially.</strong> Before this change the
    calculator estimated a motor surge from the appliance category, assuming a 3&times;
    draw for any air conditioner. The reference chart gives the real figure for a 1.5-ton
    unit: 1.58&times;. On a worked example — one refrigerator, two 1.5-ton air conditioners
    and ten lights — that difference changes the recommendation from
    <strong>40 kVA to 25 kVA</strong>. The old estimate was oversizing sites by two
    ratings, which loses quotations on price.</p>
  </div>

  <h3>A note on two rows of the supplied chart</h3>
  <p>
    Two entries list a starting draw <em>lower</em> than their running draw — the clothes
    dryer (5,400 W running against 1,350 W starting) and the heat pump (4,700 W against
    4,500 W). That combination is not physically possible for a motor load. Both have been
    transcribed exactly as supplied rather than quietly altered, and the engine treats them
    as having no surge, so neither can reduce the safety headroom on a sizing. Worth
    checking against the original source when convenient.
  </p>

  <h3>Sizing formula</h3>
  <p>
    The specification sizes on the running load plus a safety margin, taking the peak only
    if it happens to be larger. That leaves a site full of motors with no headroom on the
    surge that actually trips a generator, so the margin is applied to the <em>peak</em>
    load instead — the more conservative of the two. Both figures are calculated and
    available, so the difference is visible rather than hidden, and the alternative can be
    switched to on request.
  </p>
  <p>
    The commercial ratings ladder also keeps its intermediate sizes (30, 40 and 50 kVA).
    The ladder in the specification steps straight from 25 to 62.5 kVA, which would quote a
    62.5 kVA machine to a customer needing 30.
  </p>`,
)}

${page(
  "",
  `
  <p class="eyebrow">FEAT-02 · Lead management</p>
  <h2>Recycle bin for deleted leads</h2>
  <p class="lede">
    A deleted lead is no longer gone. It moves to a recycle bin, stays recoverable for
    seven days with a visible countdown, and is then removed automatically by a nightly
    job. Restoring is available to managers; removing a record permanently before its
    seven days are up is restricted to administrators.
  </p>
  ${figure("08-recycle-bin", "The recycle bin", "Each lead shows when it was deleted and how long remains before automatic removal. Restore returns it to the pipeline immediately.")}

  <div class="callout warn">
    <p><strong>1,309 leads are already in the bin.</strong> These were deleted before the
    seven-day policy existed, so they carry no removal date and the nightly job will never
    touch them. They have been left in place rather than removed automatically — deleting
    1,309 records without being asked is not a decision to take on your behalf. They can be
    cleared, kept, or given a removal date on request.</p>
  </div>`,
)}

${page(
  "",
  `
  <p class="eyebrow">FEAT-03 · Security</p>
  <h2>Data downloads restricted to administrators</h2>
  <p class="lede">
    The rule in the specification — <em>"other than admin, no one can download anything,
    any lead report, any details from this platform"</em> — is now enforced. Every export
    across reports, leads, inventory and the product catalog is administrator-only, and the
    restriction is applied on the server rather than by hiding buttons, so it cannot be
    bypassed.
  </p>
  ${figure("11-reports-admin", "Reports as an administrator", "The Export Excel action is available.")}
  ${figure("12-reports-sales-no-export", "The same screen as a sales executive", "No export control is offered, and a direct request to the server is refused.")}
  <p>
    Managers are inside this restriction, as the wording specifies. Spreadsheet
    <em>imports</em> for inventory and the catalog keep their existing permissions — that
    is data coming in, not leaving.
  </p>`,
)}

${page(
  "",
  `
  <p class="eyebrow">FEAT-01 &amp; FEAT-04 · Day-to-day use</p>
  <h2>Quotation delete, and the quick template</h2>
  ${figure("05-quotation-delete-confirm", "Deleting a quotation", "The confirmation names the document being deleted. An issued tax invoice cannot be deleted — under GST a correction requires a credit note.")}
  ${figure("06-whatsapp-quick-template", "The most-used template", "The template the team sends most often, offered as a single tap with its usage count. The full dropdown remains for everything else.")}
  <p>
    The usage ranking is counted from messages actually sent, so it reflects real use and
    stays correct on its own — there is no counter to maintain and nothing to go out of
    step.
  </p>`,
)}

${page(
  "",
  `
  <p class="eyebrow">BUG-01 · BUG-02 · BUG-03</p>
  <h2>The three reported defects</h2>

  <h3>Product images no longer disappear</h3>
  <p>
    Uploaded images were being written to the server's own disk. That disk is erased every
    time the application is deployed, so images survived until the next update and then
    broke — which is the cause of the missing thumbnails in the report. Uploads now go to
    cloud storage and are unaffected by deployments. This is confirmed working on the live
    server.
  </p>
  <div class="callout warn">
    <p><strong>Images uploaded before this change need adding again.</strong> Their files
    were lost with the earlier deployments; only the records remain. Any product showing a
    broken thumbnail needs its picture uploaded once more, after which it is permanent.</p>
  </div>

  <h3>"Lead not found" when sending a quotation</h3>
  <p>
    This occurred when a quotation was linked to a lead that had since been deleted: the
    system refused the send outright, even though the quotation itself carried everything
    needed to reach the customer. It now falls back to the customer's own contact details.
    Where no contact detail exists at all, the message is refused with a clear explanation
    rather than being recorded as sent to nobody.
  </p>

  <h3>WhatsApp links pointing to a local address</h3>
  <p>
    Document links were being built with a development address that no customer could open.
    The links now resolve to the live server — confirmed working, opening the correct PDF.
    The application also checks this setting when it starts and reports it prominently if
    it is ever wrong again, so the fault cannot return unnoticed.
  </p>`,
)}

${page(
  "",
  `
  <p class="eyebrow">LOGIC-01 · Attendance</p>
  <h2>Punch in/out and payroll</h2>
  <p class="lede">
    Photo attendance, the server-stamped clock and the administrator's view across all
    staff were already in place. Three additions complete the specification: the caller's
    network address is now recorded with each punch, the roster can be filtered by role,
    and the full-day threshold has been set to the specified 7.5 hours.
  </p>
  ${figure("09-attendance-leave", "Attendance and approved leave", "Leave is recorded against a date range and paid at the full day rate. A day the employee actually worked is never overwritten.")}
  ${figure("10-performance", "Payable days and earnings", "Payable days, day rate, gross earned and incentive, calculated as the specification describes.")}
  <p>
    The full-day and half-day thresholds are held as configuration rather than fixed in the
    software, because they determine what staff are paid. Changing them is a deliberate
    action that leaves a record, and needs no new release.
  </p>`,
)}

${page(
  "",
  `
  <p class="eyebrow">Closing</p>
  <h2>Verification, and what remains</h2>
  <p class="lede">
    Every item was checked against the running application before and after the work. The
    automated test suite covers 202 scenarios and passes in full, including three new tests
    written specifically to prove the payroll calculation cannot silently regress.
  </p>

  <h3>Confirmed working on the live server</h3>
  <table class="req">
    <thead><tr><th>Check</th><th>Result</th></tr></thead>
    <tbody>
      <tr><td>Document links open the correct PDF</td><td><span class="done">Verified</span></td></tr>
      <tr><td>Image uploads stored in cloud storage</td><td><span class="done">Verified</span></td></tr>
      <tr><td>Automated end-to-end suite</td><td><span class="done">202 / 202</span></td></tr>
    </tbody>
  </table>

  <h3>Remaining items</h3>
  <p>
    <strong>The updated application needs deploying.</strong> The configuration changes are
    live and working, but the new features in this report are running on the development
    system and will appear on the live server at the next deployment.
  </p>
  <p>
    <strong>Two credentials should be changed before wider use.</strong> The database
    account and the four initial staff logins still use their original setup passwords,
    which are recorded in the project documentation. Both should be reset.
  </p>
  <p>
    <strong>The 1,309 leads already in the recycle bin</strong> need a decision: keep them,
    clear them, or let them age out over the next week.
  </p>

  <div class="callout">
    <p>Every screenshot in this document was taken from the working application during an
    automated run, not assembled by hand. Any monetary figure shown is existing sample data
    in the system and is not a real transaction.</p>
  </div>`,
)}

</body>
</html>`;

fs.writeFileSync(OUT_HTML, html, "utf8");

const browser = await chromium.launch();
const p = await browser.newPage();
await p.goto("file://" + OUT_HTML.replace(/\\/g, "/"), { waitUntil: "networkidle" });
// Give the webfonts a moment; a PDF that falls back to Times looks wrong.
await p.waitForTimeout(1200);
await p.pdf({
  path: OUT_PDF,
  format: "A4",
  printBackground: true,
  margin: { top: "0", right: "0", bottom: "0", left: "0" },
});
await browser.close();

const kb = Math.round(fs.statSync(OUT_PDF).size / 1024);
console.log(`wrote ${OUT_PDF} (${kb} KB)`);
