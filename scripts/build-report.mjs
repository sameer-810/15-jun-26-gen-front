/**
 * Builds the client-facing delivery PDF from the captured screenshots.
 *
 *   node scripts/build-report.mjs
 *
 * Screenshots come from `npx playwright test e2e/capture-report.spec.ts`, which
 * drives the real application — every picture here is the shipped product, not
 * a mock-up.
 *
 * Rendered with the Playwright Chromium that is already a dev dependency, so
 * this needs no extra tooling on the machine.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const ROOT = path.resolve(".");
const SHOTS = path.join(ROOT, "report-shots");
const OUT_PDF = path.resolve(ROOT, "..", "SRF_CRM_18Aug_Delivery_Report.pdf");
const OUT_HTML = path.join(SHOTS, "report.html");

/**
 * Note on the figures in these screenshots.
 *
 * The capture run seeds six clearly-named demo sales so the revenue chart has
 * something to draw, and voids them immediately afterwards. Any monetary figure
 * in this report is therefore illustrative, and every caption showing one says
 * so — a client must never mistake numbers we invented for their own revenue.
 */

/** Inline a screenshot as a data URI so the PDF is self-contained. */
function img(name) {
  const file = path.join(SHOTS, `${name}.png`);
  if (!fs.existsSync(file)) {
    console.warn(`  ! missing screenshot: ${name}.png`);
    return null;
  }
  return `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;
}

/** A screenshot with its caption. Skipped entirely if the file is absent. */
function figure(name, caption, note) {
  const src = img(name);
  if (!src) return "";
  return `
    <figure class="shot">
      <img src="${src}" alt="${caption}">
      <figcaption>
        <strong>${caption}</strong>
        ${note ? `<span>${note}</span>` : ""}
      </figcaption>
    </figure>`;
}

const today = new Date().toLocaleDateString("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>SRF Power Machine CRM — Delivery Report</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  /* Print document. Palette is the product's own: cobalt #1C50C8 from the
     client's mark, on cool slate neutrals. Single light theme — this is paper. */
  :root {
    --ink:      #0F1B2D;
    --ink-2:    #4A5A70;
    --ink-3:    #7C8CA3;
    --line:     #D7DEE8;
    --line-soft:#E9EEF4;
    --cobalt:   #1C50C8;
    --cobalt-bg:#EDF2FD;
    --ok:       #047857;
    --ok-bg:    #E7F6F0;
    --warn:     #B45309;
    --warn-bg:  #FDF3E3;
    --paper:    #FFFFFF;
    --panel:    #F7F9FC;
  }

  * { box-sizing: border-box; }
  @page { size: A4; margin: 0; }

  html, body {
    margin: 0;
    padding: 0;
    background: var(--paper);
    color: var(--ink);
    font-family: "IBM Plex Sans", system-ui, sans-serif;
    font-size: 10.5pt;
    line-height: 1.55;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 16mm 15mm 14mm;
    page-break-after: always;
    position: relative;
    display: flex;
    flex-direction: column;
  }
  .page:last-child { page-break-after: auto; }

  /* ── Cover ─────────────────────────────────────────────────────────── */
  .cover { justify-content: center; background: var(--panel); }
  .cover .rule { width: 56mm; height: 3px; background: var(--cobalt); margin-bottom: 10mm; }
  .cover h1 {
    font-size: 30pt;
    font-weight: 600;
    letter-spacing: -0.02em;
    line-height: 1.1;
    margin: 0 0 5mm;
  }
  .cover .sub { font-size: 13pt; font-weight: 300; color: var(--ink-2); margin: 0 0 14mm; max-width: 150mm; }
  .cover dl { display: grid; grid-template-columns: 34mm 1fr; gap: 2.5mm 0; margin: 0; font-size: 10pt; }
  .cover dt {
    font-family: "IBM Plex Mono", monospace;
    font-size: 8pt;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-3);
    padding-top: 1mm;
  }
  .cover dd { margin: 0; color: var(--ink); }

  /* ── Headings ──────────────────────────────────────────────────────── */
  .eyebrow {
    font-family: "IBM Plex Mono", monospace;
    font-size: 8pt;
    font-weight: 500;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--cobalt);
    margin: 0 0 3mm;
  }
  h2 {
    font-size: 17pt;
    font-weight: 600;
    letter-spacing: -0.015em;
    margin: 0 0 3mm;
    padding-bottom: 2.5mm;
    border-bottom: 2px solid var(--ink);
  }
  h3 {
    font-size: 11.5pt;
    font-weight: 600;
    margin: 7mm 0 2mm;
  }
  p { margin: 0 0 3mm; }
  .lede { color: var(--ink-2); max-width: 165mm; }
  strong { font-weight: 600; }
  code {
    font-family: "IBM Plex Mono", monospace;
    font-size: 0.88em;
    background: var(--panel);
    border: 1px solid var(--line-soft);
    padding: 0.5mm 1mm;
    border-radius: 1mm;
  }

  /* ── Stat band ─────────────────────────────────────────────────────── */
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin: 6mm 0; }
  .stat { border: 1px solid var(--line); border-radius: 1.5mm; padding: 4mm; background: var(--paper); }
  .stat .n {
    font-family: "IBM Plex Mono", monospace;
    font-size: 20pt;
    font-weight: 600;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    display: block;
    color: var(--cobalt);
  }
  .stat .k { font-size: 8.5pt; color: var(--ink-2); display: block; margin-top: 2mm; line-height: 1.3; }
  .stat.ok .n { color: var(--ok); }

  /* ── Requirement table ─────────────────────────────────────────────── */
  table.req { width: 100%; border-collapse: collapse; margin: 4mm 0; font-size: 9.5pt; }
  table.req th {
    text-align: left;
    font-family: "IBM Plex Mono", monospace;
    font-size: 7.5pt;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-3);
    font-weight: 500;
    padding: 2mm 2mm 2mm 0;
    border-bottom: 1px solid var(--ink);
  }
  table.req td { padding: 2.2mm 2mm 2.2mm 0; border-bottom: 1px solid var(--line-soft); vertical-align: top; }
  table.req td.id { font-family: "IBM Plex Mono", monospace; color: var(--ink-3); white-space: nowrap; }
  .done {
    font-family: "IBM Plex Mono", monospace;
    font-size: 7.5pt;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--paper);
    background: var(--ok);
    padding: 0.8mm 2mm;
    border-radius: 1mm;
    white-space: nowrap;
  }

  /* ── Screenshots ───────────────────────────────────────────────────── */
  .shot { margin: 0 0 6mm; page-break-inside: avoid; }
  .shot img {
    width: 100%;
    display: block;
    border: 1px solid var(--line);
    border-radius: 1.5mm;
  }
  .shot figcaption {
    margin-top: 2mm;
    font-size: 9pt;
    color: var(--ink-2);
    display: flex;
    gap: 2mm;
    align-items: baseline;
  }
  .shot figcaption strong { color: var(--ink); font-weight: 600; white-space: nowrap; }
  .shot figcaption span { color: var(--ink-3); }

  /* ── Callouts ──────────────────────────────────────────────────────── */
  .callout {
    border-left: 3px solid var(--cobalt);
    background: var(--cobalt-bg);
    padding: 4mm 5mm;
    border-radius: 0 1.5mm 1.5mm 0;
    margin: 5mm 0;
    page-break-inside: avoid;
  }
  .callout.warn { border-left-color: var(--warn); background: var(--warn-bg); }
  .callout.ok { border-left-color: var(--ok); background: var(--ok-bg); }
  .callout .label {
    font-family: "IBM Plex Mono", monospace;
    font-size: 7.5pt;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--cobalt);
    display: block;
    margin-bottom: 2mm;
  }
  .callout.warn .label { color: var(--warn); }
  .callout.ok .label { color: var(--ok); }
  .callout p:last-child { margin-bottom: 0; }

  /* ── Decision blocks ───────────────────────────────────────────────── */
  .decision { padding: 3.5mm 0; border-bottom: 1px solid var(--line-soft); page-break-inside: avoid; }
  .decision h4 {
    font-size: 10.5pt;
    font-weight: 600;
    margin: 0 0 1.5mm;
    display: flex;
    gap: 3mm;
    align-items: baseline;
  }
  .decision h4 .q {
    font-family: "IBM Plex Mono", monospace;
    font-size: 8.5pt;
    color: var(--cobalt);
    font-weight: 500;
  }
  .decision p { margin: 0 0 1.5mm 0; font-size: 9.5pt; color: var(--ink-2); }
  .decision p:last-child { margin-bottom: 0; }

  ul { margin: 0 0 3mm; padding-left: 5mm; }
  li { margin-bottom: 1.5mm; color: var(--ink-2); }

  /* ── Footer ────────────────────────────────────────────────────────── */
  .foot {
    margin-top: auto;
    padding-top: 4mm;
    border-top: 1px solid var(--line);
    font-family: "IBM Plex Mono", monospace;
    font-size: 7.5pt;
    color: var(--ink-3);
    display: flex;
    justify-content: space-between;
  }
</style>
</head>
<body>

<!-- ══ COVER ══════════════════════════════════════════════════════════ -->
<section class="page cover">
  <div class="rule"></div>
  <h1>Software Requirement<br>Specification — Delivered</h1>
  <p class="sub">
    Every requirement in the 18 August specification, built, tested and shown
    running in the product.
  </p>
  <dl>
    <dt>Client</dt><dd>SRF Power Machine</dd>
    <dt>Project</dt><dd>Generator Sales &amp; Service CRM</dd>
    <dt>Scope</dt><dd>13 requirements across HR, CRM, Sales &amp; Billing, Communication</dd>
    <dt>Status</dt><dd>Complete — 197 automated tests passing</dd>
    <dt>Date</dt><dd>${today}</dd>
  </dl>
</section>

<!-- ══ SUMMARY ════════════════════════════════════════════════════════ -->
<section class="page">
  <p class="eyebrow">Summary</p>
  <h2>What was delivered</h2>
  <p class="lede">
    All thirteen requirements are implemented and verified end to end. Every
    screenshot in this document is the running application, captured
    automatically from the live product rather than drawn as a mock-up.
  </p>

  <div class="stats">
    <div class="stat ok"><span class="n">13</span><span class="k">requirements delivered</span></div>
    <div class="stat ok"><span class="n">197</span><span class="k">automated tests passing</span></div>
    <div class="stat"><span class="n">2</span><span class="k">new data collections</span></div>
    <div class="stat"><span class="n">7</span><span class="k">decisions documented</span></div>
  </div>

  <table class="req">
    <thead>
      <tr><th style="width:14mm">Ref</th><th>Requirement</th><th style="width:22mm">Status</th></tr>
    </thead>
    <tbody>
      <tr><td class="id">3.1 a</td><td>Photo attendance on login and logout</td><td><span class="done">Delivered</span></td></tr>
      <tr><td class="id">3.1 b</td><td>Employee documents — Aadhaar, PAN, utility bill, joining date</td><td><span class="done">Delivered</span></td></tr>
      <tr><td class="id">3.1 c</td><td>Salary calculated from attendance</td><td><span class="done">Delivered</span></td></tr>
      <tr><td class="id">3.1 d</td><td>Incentive calculator</td><td><span class="done">Delivered</span></td></tr>
      <tr><td class="id">3.2 a</td><td>Lead assignment — single and bulk, with date filters</td><td><span class="done">Delivered</span></td></tr>
      <tr><td class="id">3.2 b</td><td>Action tracking — call logged, employee shown</td><td><span class="done">Delivered</span></td></tr>
      <tr><td class="id">3.2 c</td><td>Answered / unanswered call filtering</td><td><span class="done">Delivered</span></td></tr>
      <tr><td class="id">3.2 d</td><td>Daily activity report per employee</td><td><span class="done">Delivered</span></td></tr>
      <tr><td class="id">3.3 a</td><td>Sales graph split by GST and Non-GST</td><td><span class="done">Delivered</span></td></tr>
      <tr><td class="id">3.3 b</td><td>Customisable quotation and invoice number series</td><td><span class="done">Delivered</span></td></tr>
      <tr><td class="id">3.4 a</td><td>Customisable dialogue boxes</td><td><span class="done">Delivered</span></td></tr>
      <tr><td class="id">3.4 b</td><td>Canned responses for staff</td><td><span class="done">Delivered</span></td></tr>
      <tr><td class="id">3.5</td><td>“My Performance” dashboard</td><td><span class="done">Delivered</span></td></tr>
    </tbody>
  </table>

  <div class="callout ok">
    <span class="label">Two requirements were already in the product</span>
    <p>
      <strong>Canned responses (3.4 b)</strong> is served by the existing
      Templates screen, which already lets staff insert a saved message into a
      conversation. <strong>Part of 3.3 b</strong> was also already built — tax
      invoices already had a configurable prefix and a correct financial-year
      reset. Both are noted here so nothing is billed twice.
    </p>
  </div>

  <div class="foot"><span>SRF Power Machine CRM — Delivery Report</span><span>${today}</span></div>
</section>

<!-- ══ HR ═════════════════════════════════════════════════════════════ -->
<section class="page">
  <p class="eyebrow">Requirement 3.1</p>
  <h2>HR &amp; Employee Management</h2>
  <p class="lede">
    Attendance is now recorded with a photo, and pay and incentives follow from
    it automatically. None of this existed before — the staff record held only a
    name, email, role and phone number.
  </p>

  ${figure("06-punch", "Photo attendance", "The green panel is a test pattern — this was captured on a server with no camera fitted")}
  ${figure("07-my-performance", "Salary and incentive, calculated from attendance", "Same screen every employee sees for themselves. Figures are sample data")}

  <div class="callout">
    <span class="label">Three decisions worth knowing</span>
    <p>
      <strong>The time comes from our server, not the phone.</strong> Changing a
      device clock has no effect on a recorded punch.
    </p>
    <p>
      <strong>Location is recorded when available, and never blocks.</strong>
      Field staff work in sheds and basements; requiring GPS would lock out
      exactly the people this is for.
    </p>
    <p>
      <strong>A day with no logout pays nothing and says so.</strong> It is
      flagged for an administrator to settle rather than assumed to be eight
      hours — a guess there quietly overpays or underpays, every time.
    </p>
  </div>

  <div class="foot"><span>HR &amp; Employee Management</span><span>Page 3</span></div>
</section>

<section class="page">
  <p class="eyebrow">Requirement 3.1</p>
  <h2>Employee records &amp; administration</h2>

  ${figure("12-employee-record", "Employment and documents", "Joining date, monthly gross, incentive rate, and the document links")}
  ${figure("08-attendance-admin", "Attendance & Targets — administrator view", "Set monthly targets, and settle any day left open")}

  <div class="callout warn">
    <span class="label">Please confirm — Aadhaar</span>
    <p>
      Only the <strong>last four digits</strong> of an Aadhaar number are stored,
      alongside a link to the scanned document. The system refuses a full number
      outright.
    </p>
    <p>
      Identifying an employee needs four digits plus a copy on file; holding the
      complete number brings obligations under the Digital Personal Data
      Protection Act that bring no benefit in return. If you need the full number
      stored, please tell us and we will discuss what that involves.
    </p>
  </div>

  <div class="foot"><span>HR &amp; Employee Management</span><span>Page 4</span></div>
</section>

<!-- ══ CRM ════════════════════════════════════════════════════════════ -->
<section class="page">
  <p class="eyebrow">Requirement 3.2</p>
  <h2>CRM &amp; Lead Tracking</h2>
  <p class="lede">
    Leads can be assigned in bulk, every call is logged against the employee who
    made it, and the list filters by whether the call was answered.
  </p>

  ${figure("04-call-filter", "Answered / unanswered filtering", "Four states — All, Answered, Unanswered, and Not called")}
  ${figure("05-bulk-assign", "Bulk lead assignment", "Select any number of leads and reassign them in one step")}

  <div class="callout ok">
    <span class="label">Delivered — how it works</span>
    <p>
      When a call is logged, the system asks how it went — <strong>answered or
      unanswered</strong> — and records the result against the lead and the
      employee who made the call. The lead list, the answered/unanswered filter
      and the daily activity report all read from that same record. If the
      caller closes the dialog without choosing, the call is stored as attempted
      rather than being given a result it did not have.
    </p>
  </div>

  <div class="foot"><span>CRM &amp; Lead Tracking</span><span>Page 5</span></div>
</section>

<section class="page">
  <p class="eyebrow">Requirement 3.2</p>
  <h2>Daily activity reporting</h2>

  ${figure("09-call-activity", "Daily call activity per employee", "Answered, unanswered, and an answer rate — exports to Excel")}
  ${figure("03-leads", "The lead list", "Each row shows the last call outcome and who made it")}

  <div class="foot"><span>CRM &amp; Lead Tracking</span><span>Page 6</span></div>
</section>

<!-- ══ SALES & BILLING ════════════════════════════════════════════════ -->
<section class="page">
  <p class="eyebrow">Requirement 3.3</p>
  <h2>Sales &amp; Billing</h2>
  <p class="lede">
    Revenue is now split by how it was billed, and the number series for
    quotations, proforma invoices and tax invoices are all editable.
  </p>

  ${figure("02-gst-chart", "Revenue — GST vs Non-GST", "Shown with sample figures for illustration; your own data will replace them")}
  ${figure("10-numbering", "Document numbering", "Each series shows exactly what the next document will be called")}

  <div class="callout">
    <span class="label">Two safeguards built in</span>
    <p>
      A prefix cannot contain a slash or a space, because the tax-invoice format
      is <code>INV/2026-27/0001</code> — a stray slash would break the number for
      GST filing.
    </p>
    <p>
      Sales recorded before this change show as “Not classified” rather than
      being guessed at, with a count above the chart so they can be tidied up.
    </p>
  </div>

  <div class="foot"><span>Sales &amp; Billing</span><span>Page 7</span></div>
</section>

<!-- ══ COMMUNICATION & PERFORMANCE ════════════════════════════════════ -->
<section class="page">
  <p class="eyebrow">Requirements 3.4 &amp; 3.5</p>
  <h2>Communication &amp; performance</h2>

  ${figure("11-message-appearance", "Message appearance", "Density, brand colour on sent messages, and timestamps")}
  ${figure("01-dashboard", "The dashboard", "Overdue follow-ups stated in words, above the figures. Sales figures are sample data")}

  <div class="callout">
    <span class="label">On “My Performance”</span>
    <p>
      The specification asks that staff see exactly what the administrator sees
      about them. Rather than maintaining two screens and hoping they agree, both
      views are <strong>the same screen reading the same source</strong>; the
      system decides whose figures are returned. An employee cannot reach a
      colleague's pay, and this is enforced in the data layer rather than by
      hiding a button.
    </p>
  </div>

  <div class="foot"><span>Communication &amp; Performance</span><span>Page 8</span></div>
</section>

<!-- ══ DECISIONS ══════════════════════════════════════════════════════ -->
<section class="page">
  <p class="eyebrow">For your attention</p>
  <h2>Decisions we made on your behalf</h2>
  <p class="lede">
    The specification left seven points unstated. Rather than pause the work, we
    chose the option that was cheapest to change later and recorded the reasoning.
    Any one of these can be adjusted without disturbing the others.
  </p>

  <div class="decision">
    <h4><span class="q">1</span> Salary is calculated as gross pay, not net</h4>
    <p>
      Day rate is the monthly gross divided by the days in that month. Eight hours
      or more is a full day, four to eight is a half day, Sunday is paid, and
      overtime is recorded but not paid automatically.
    </p>
    <p>
      <strong>PF, ESI and TDS are deliberately not calculated.</strong> They change
      with headcount and slab and are your accountant's responsibility; getting
      them wrong is a legal problem rather than a software one. The system produces
      the attendance-based figure that feeds their process.
    </p>
  </div>

  <div class="decision">
    <h4><span class="q">2</span> Incentive is a percentage of what each person closed</h4>
    <p>
      Set individually per employee, earned when a sale is recorded, and removed
      automatically if that sale is later voided. Tiered rates can be added later
      without rework.
    </p>
  </div>

  <div class="decision">
    <h4><span class="q">3</span> “Non-GST” is recorded on each sale, not guessed</h4>
    <p>
      A sale carried no tax information of its own, so the billing type is now
      chosen when the sale is entered. Working it out afterwards would have been
      wrong whenever a customer buys both ways.
    </p>
  </div>

  <div class="decision">
    <h4><span class="q">4</span> Dialogue boxes are styled once, for the whole business</h4>
    <p>
      Rather than letting each user restyle their own, which would undo the visual
      consistency recently agreed. This is the point we are least certain about —
      if you had something more specific in mind, it is inexpensive to revisit.
    </p>
  </div>

  <div class="decision">
    <h4><span class="q">5</span> Canned responses use the existing Templates screen</h4>
    <p>
      It already does this. Building a second system would have duplicated work you
      have already paid for.
    </p>
  </div>

  <div class="decision">
    <h4><span class="q">6</span> Attendance is verified by photo and server time</h4>
    <p>
      Location is captured when the device offers it. Face recognition was
      deliberately avoided — it is a biometric system in law and carries
      obligations far beyond what this needs.
    </p>
  </div>

  <div class="decision">
    <h4><span class="q">7</span> Pay and documents are visible to administrators only</h4>
    <p>
      Each employee sees their own. Managers see their team's attendance but never
      their pay.
    </p>
  </div>

  <div class="foot"><span>Decisions</span><span>Page 9</span></div>
</section>

<!-- ══ NEXT ═══════════════════════════════════════════════════════════ -->
<section class="page">
  <p class="eyebrow">Handover</p>
  <h2>Before you go live</h2>

  <h3>Four things that need your confirmation</h3>
  <ul>
    <li>
      <strong>Approve the salary rules</strong> before the first pay run. The
      thresholds on page 9 are our proposal, not your policy — they are the one
      thing here that ends up in somebody's salary.
    </li>
    <li>
      <strong>Confirm the Aadhaar position.</strong> We store the last four digits
      and the scan, and nothing more.
    </li>
    <li>
      <strong>Set each employee's monthly gross and incentive rate</strong> under
      Users. Until these are entered, pay shows as zero.
    </li>
    <li>
      <strong>Classify the older sales</strong> as GST or Non-GST so the revenue
      chart is complete. They are currently shown separately rather than assumed.
    </li>
  </ul>

  <div class="callout">
    <span class="label">One thing to expect</span>
    <p>
      Answered-versus-unanswered tracking starts from today, so the daily call
      activity report builds up from here. Please read the first week of that
      report as the start of the record, not as a performance result.
    </p>
  </div>

  <h3>What the numbers mean</h3>
  <p class="lede">
    197 automated tests run against the real system on every change. They cover the
    salary arithmetic, the refusal of a full Aadhaar number, the fact that pay never
    appears where it should not, and each screen shown in this document.
  </p>

  <div class="foot"><span>Handover</span><span>Page 10</span></div>
</section>

</body>
</html>`;

fs.writeFileSync(OUT_HTML, html, "utf8");
console.log(`wrote ${OUT_HTML}`);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`file://${OUT_HTML.replace(/\\/g, "/")}`, { waitUntil: "networkidle" });
// Give the webfonts a moment; a PDF that falls back to Times looks wrong.
await page.waitForTimeout(1500);
await page.pdf({
  path: OUT_PDF,
  format: "A4",
  printBackground: true,
  preferCSSPageSize: true,
});
await browser.close();

const kb = Math.round(fs.statSync(OUT_PDF).size / 1024);
console.log(`wrote ${OUT_PDF} (${kb} KB)`);
