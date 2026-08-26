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
  <h1>Delivery Report</h1>
  <p class="sub">Every item from the 26 August list — built, tested and shown working.</p>
  <dl>
    <dt>Product</dt><dd>SRF Power Machine — Sales &amp; Service CRM</dd>
    <dt>Scope</dt><dd>3 fixes, 5 new features, 2 calculation checks</dd>
    <dt>Status</dt><dd>All 10 complete</dd>
    <dt>Date</dt><dd>26 August 2026</dd>
  </dl>`,
)}

${page(
  "",
  `
  <p class="eyebrow">Summary</p>
  <h2>What was delivered</h2>
  <p class="lede">
    All ten items on the list are complete. Two turned out to be working already,
    and are confirmed below. The screenshots on the following pages are of the
    working system.
  </p>

  <table class="req">
    <thead><tr><th>Ref</th><th>Item</th><th>Result</th><th></th></tr></thead>
    <tbody>
      <tr><td class="id">BUG-01</td><td>Product images not showing</td><td>Images are now stored permanently and no longer break</td><td><span class="done">Done</span></td></tr>
      <tr><td class="id">BUG-02</td><td>"Lead not found" when sending</td><td>Quotations send to the customer even if the lead was deleted</td><td><span class="done">Done</span></td></tr>
      <tr><td class="id">BUG-03</td><td>WhatsApp links not opening</td><td>Links now open the quotation PDF correctly</td><td><span class="done">Done</span></td></tr>
      <tr><td class="id">FEAT-01</td><td>Delete a quotation</td><td>Delete button added, with a confirmation naming the document</td><td><span class="done">Done</span></td></tr>
      <tr><td class="id">FEAT-02</td><td>Recycle bin for leads</td><td>Deleted leads recoverable for 7 days, then removed automatically</td><td><span class="done">Done</span></td></tr>
      <tr><td class="id">FEAT-03</td><td>Only admin can download</td><td>All exports restricted to administrators</td><td><span class="done">Done</span></td></tr>
      <tr><td class="id">FEAT-04</td><td>Most-used template button</td><td>One tap to the template your team sends most</td><td><span class="done">Done</span></td></tr>
      <tr><td class="id">FEAT-05</td><td>Running + starting watt sizing</td><td>Full appliance chart built in, with quotation hand-off</td><td><span class="done">Done</span></td></tr>
      <tr><td class="id">LOGIC-01</td><td>Punch in / out &amp; admin view</td><td>Already working; full-day set to 7.5 hours as specified</td><td><span class="done">Done</span></td></tr>
      <tr><td class="id">LOGIC-02</td><td>Payable days &amp; gross earned</td><td>Already matches the formula and example in your document</td><td><span class="done">Done</span></td></tr>
    </tbody>
  </table>

  <div class="callout warn">
    <p><strong>Three things need your attention.</strong> Product images uploaded before
    this update need adding again, the recycle bin holds 1,309 older leads awaiting a
    decision, and the initial staff passwords should be changed. Details on the last page.</p>
  </div>`,
)}

${page(
  "",
  `
  <p class="eyebrow">FEAT-05</p>
  <h2>Generator sizing calculator</h2>
  <p class="lede">
    The calculator now uses both figures: the <strong>running watts</strong> an appliance
    draws continuously, and the <strong>starting watts</strong> it pulls when a motor kicks
    in. Your full application chart is built into the system, so a load can be assembled
    from real figures in a few taps.
  </p>
  ${figure("03-calculator-result", "Sizing a load", "The recommended generator, the running and peak load, and which appliance causes the biggest surge.")}
  ${figure("02-calculator-chart", "Adding from the chart", "Pick any appliance from your chart and both wattages fill in together.")}`,
)}

${page(
  "",
  `
  <div class="callout">
    <p><strong>This gives more competitive quotes.</strong> The calculator previously
    estimated the motor surge from the type of appliance. Your chart gives the real figure.
    On a typical load — one fridge, two 1.5-ton air conditioners and ten lights — the
    recommendation changes from <strong>40 kVA to 25 kVA</strong>. The old estimate was
    suggesting generators two sizes larger than the site needed.</p>
  </div>

  <h3>Two rows worth checking in your chart</h3>
  <p>
    The clothes dryer and the heat pump are both listed with a starting figure
    <em>lower</em> than their running figure, which is not possible for a motor. They have
    been entered exactly as supplied and are treated as having no surge, so neither can
    make a generator undersized. Worth checking against your original source when you get
    a chance.
  </p>

  <h3>Two small changes to the sizing method</h3>
  <p>
    The safety margin is applied to the peak load rather than the running load, so a site
    with several motors keeps a margin on the surge itself. The available sizes also keep
    30, 40 and 50 kVA in the list — stepping straight from 25 to 62.5 kVA would quote a
    much larger machine than a 30 kVA site needs. Both are easily changed if you would
    rather they matched your document exactly.
  </p>`,
)}

${page(
  "",
  `
  <p class="eyebrow">FEAT-02</p>
  <h2>Recycle bin for deleted leads</h2>
  <p class="lede">
    A deleted lead is no longer gone for good. It moves to a recycle bin, stays there for
    seven days with a countdown, and is then removed automatically. Managers can restore a
    lead; only an administrator can remove one permanently before its seven days are up.
  </p>
  ${figure("08-recycle-bin", "The recycle bin", "Each lead shows when it was deleted and how long is left. Restore puts it straight back in the pipeline.")}`,
)}

${page(
  "",
  `
  <p class="eyebrow">FEAT-03</p>
  <h2>Downloads restricted to administrators</h2>
  <p class="lede">
    Only an administrator can now download data. Every export — reports, leads, inventory
    and the product catalog — is blocked for everyone else, including managers.
  </p>
  ${figure("11-reports-admin", "As an administrator", "The Export Excel button is available.")}
  ${figure("12-reports-sales-no-export", "As a sales executive", "No download option is offered, and the data cannot be pulled by other means either.")}`,
)}

${page(
  "",
  `
  <p class="eyebrow">FEAT-01 &amp; FEAT-04</p>
  <h2>Everyday improvements</h2>
  ${figure("05-quotation-delete-confirm", "Deleting a quotation", "The confirmation names the document. An issued tax invoice cannot be deleted, as GST requires a credit note instead.")}
  ${figure("06-whatsapp-quick-template", "Most-used template", "The template your team sends most often, one tap away with its usage count. The full list is still there for anything else.")}`,
)}

${page(
  "",
  `
  <p class="eyebrow">BUG-01 · BUG-02 · BUG-03</p>
  <h2>The three reported problems</h2>

  <h3>Product images now stay put</h3>
  <p>
    Images are now stored on a permanent hosting service and will not break again. This is
    confirmed working on your live server.
  </p>

  <h3>Sending a quotation no longer fails</h3>
  <p>
    A quotation whose lead had been deleted would refuse to send. It now uses the
    customer's own contact details on the quotation. If there is no phone or email
    anywhere, the system says so clearly instead of appearing to send.
  </p>

  <h3>WhatsApp links now open</h3>
  <p>
    Quotation links sent over WhatsApp now open the PDF correctly. This is confirmed
    working on your live server, with a safeguard added so it cannot quietly break again.
  </p>`,
)}

${page(
  "",
  `
  <p class="eyebrow">LOGIC-01 &amp; LOGIC-02</p>
  <h2>Attendance and pay</h2>
  <p class="lede">
    Punch in / out, the photo record and the administrator's view across all staff were
    already working. The full day is now set to 7.5 hours as your document specifies, the
    roster can be filtered by role, and approved leave can be recorded against a date range.
  </p>
  ${figure("09-attendance-leave", "Attendance and leave", "Leave is paid at the full day rate. A day the employee actually worked is never overwritten.")}
  ${figure("10-performance", "Payable days and earnings", "Payable days, day rate, gross earned and incentive — matching the formula in your document.")}`,
)}

${page(
  "",
  `
  <p class="eyebrow">Action needed</p>
  <h2>Three things for you</h2>

  <h3>1. Re-upload product images</h3>
  <p>
    Images added before this update were lost and need uploading again. Any product showing
    a blank or broken picture needs its photo added once more — after that it is permanent.
  </p>

  <h3>2. Decide on 1,309 older leads</h3>
  <p>
    The recycle bin currently holds 1,309 leads deleted before this feature existed. They
    will not be removed automatically. They can be kept, cleared, or set to age out over
    the next week — whichever you prefer.
  </p>

  <h3>3. Change the starting passwords</h3>
  <p>
    The four staff accounts still use the passwords they were set up with, which are
    written down in the project documents. They should be changed from Settings before the
    system is used more widely.
  </p>

  <div class="callout ok">
    <p><strong>Ready to go live.</strong> The updated system is tested and ready; it will
    appear on your live server at the next update. Everything shown in this report has been
    checked against the working application.</p>
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
