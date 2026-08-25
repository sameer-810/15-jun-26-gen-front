/**
 * Builds the client-facing mobile redesign PDF: every screen, before and after,
 * side by side at real phone size.
 *
 * Cover, then comparisons — nothing else. This goes to the client unedited, so
 * it shows the work rather than arguing for it.
 *
 *   MOBILE_SHOT_DIR=mobile-before npx playwright test e2e/capture-mobile.spec.ts
 *   MOBILE_SHOT_DIR=mobile-after  npx playwright test e2e/capture-mobile.spec.ts
 *   node scripts/build-mobile-report.mjs
 *
 * Both screenshot sets come from the same spec driving the real application at
 * 390x844, so the two columns are the same screens at the same viewport with the
 * same data — the comparison is honest, not a redraw.
 *
 * Rendered with the Playwright Chromium already in devDependencies.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const ROOT = path.resolve(".");
const SHOTS = path.join(ROOT, "report-shots");
const BEFORE = path.join(SHOTS, "mobile-before");
const AFTER = path.join(SHOTS, "mobile-after");
const OUT_PDF = path.resolve(ROOT, "..", "SRF_CRM_Mobile_Redesign.pdf");
const OUT_HTML = path.join(SHOTS, "mobile-report.html");

/** Inline a screenshot as a data URI so the PDF is self-contained. */
function img(dir, name) {
  const file = path.join(dir, `${name}.png`);
  if (!fs.existsSync(file)) return null;
  return `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;
}

/**
 * One screen, before beside after.
 *
 * A pair is dropped entirely if either side is missing rather than rendered
 * half-empty: a comparison with one column is not a comparison, and a blank
 * frame in a client document reads as a bug in the product.
 */
function pair(name, title, whatChanged) {
  const b = img(BEFORE, name);
  const a = img(AFTER, name);
  if (!b || !a) {
    console.warn(`  ! skipping ${name} — missing ${!b ? "before" : "after"}`);
    return "";
  }
  return `
    <section class="pair">
      <h3>${title}</h3>
      <p class="change">${whatChanged}</p>
      <div class="shots">
        <figure><img src="${b}" alt="${title} before"><figcaption><span class="tag before">Before</span></figcaption></figure>
        <figure><img src="${a}" alt="${title} after"><figcaption><span class="tag after">After</span></figcaption></figure>
      </div>
    </section>`;
}

/** The screens, in the order the report walks through them. */
const SCREENS = [
  [
    "02-leads",
    "Leads",
    "Opened with roughly 1,200px of filter form — seven controls — before the first lead. Now three leads are visible immediately, each with Call and WhatsApp on the card. The filters moved into a sheet behind the button beside search, which shows a count when any are active.",
  ],
  [
    "01-dashboard",
    "Dashboard",
    "Four stat tiles stacked one per row, about 1,000px of scrolling for four numbers. Now two-up, all four above the fold, with rupee figures in lakh/crore so they fit the tile instead of wrapping mid-number.",
  ],
  [
    "04-quotations",
    "Quotations & PI",
    "A 1,100px table showing three of its eight columns; amount, status and every action were off-screen to the right. Now a card per document with the number and grand total anchoring the two top corners, and PDF and Share on the card.",
  ],
  [
    "05-sales",
    "Sales",
    "Nine columns across 1,100px. Now who bought it, what they bought and what it came to — the unit-price and tax split stay on the desktop view, where they are read.",
  ],
  [
    "06-inventory",
    "Inventory",
    "A 1,200px table. Availability is the figure this screen exists to answer, so it takes the headline position, with Edit and Add stock on the card.",
  ],
  [
    "07-catalog",
    "Product Catalog",
    "The product thumbnail earns its place on a phone in a way it did not in the table — it is how a genset is recognised faster than a model code.",
  ],
  [
    "03-lead-detail",
    "Lead detail",
    "Already close to right; tightened. The duplicated 'Back to leads' link is gone now that the top bar carries a back chevron.",
  ],
  [
    "08-reports",
    "Reports",
    "Five report tabs wrapped onto two rows and the results table was cut off at the right edge with no way to reach the last columns. Tabs are now one scrolling line, and each row is a labelled card.",
  ],
  ["09-my-performance", "My Performance", "Stat tiles two-up, matching the dashboard."],
  [
    "10-attendance",
    "Attendance & Targets",
    "A 720px table of dates and times. Now a card per day: who, the in/out pair, hours worked, and Settle where a day is unresolved.",
  ],
  [
    "11-activity",
    "Activity Log",
    "The note composer and filter block filled the whole first screen, so the audit trail began below the fold. The composer is behind the add button; the log starts at the top.",
  ],
  [
    "14-users",
    "Users & Roles",
    "An 800px table that also had Actions in the leftmost column, so every row began with the same two buttons and the person's name came second. Corrected on both layouts.",
  ],
  [
    "16-capacity",
    "Capacity Calculator",
    "A table of inputs scrolling sideways, with the headers that say which box is Watts scrolling away too. Now one labelled block per appliance.",
  ],
  [
    "13-locations",
    "Locations",
    "As Users: a 900px table with Actions in the anchor column. Card list on mobile, Actions moved last on desktop.",
  ],
  ["12-templates", "Templates", "Kind tabs on one scrolling line rather than two wrapped rows."],
  [
    "15-settings",
    "Settings",
    "Already a stacked form and already worked; the duplicated page title is gone since the top bar names the screen.",
  ],
  [
    "17-navigation",
    "Navigation",
    "The full-height drawer reached from a hamburger in the top-left corner — the furthest point on the screen from a right thumb — is replaced by a bottom tab bar with the four destinations each role uses most, and a More sheet holding the rest.",
  ],
];

const today = new Date().toLocaleDateString("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const rendered = SCREENS.map(([n, t, c]) => pair(n, t, c)).filter(Boolean);
const pairCount = rendered.length;

/**
 * Two pairs to a page, each in its own `.page` section.
 *
 * Letting all seventeen flow inside one tall `.page` looks right in a browser
 * and prints wrong: the section's 16mm/14mm padding is applied once, at the very
 * top and the very bottom, so every intermediate sheet has its images running
 * into the paper edge. Chunking gives each printed sheet its own margins.
 */
const PAIRS_PER_PAGE = 2;
const pairPages = [];
for (let i = 0; i < rendered.length; i += PAIRS_PER_PAGE) {
  const chunk = rendered.slice(i, i + PAIRS_PER_PAGE).join("\n");
  const first = i === 0;
  pairPages.push(`
<section class="page">
  ${
    first
      ? `<p class="eyebrow">Screen by screen</p>
  <h2>Before and after</h2>
  <p class="lede" style="margin-bottom:6mm">
    Both columns are the running application at 390&times;844 with the same data.
  </p>`
      : ""
  }
  ${chunk}
  <div class="foot"><span>SRF Power Machine CRM — Mobile redesign</span><span>${today}</span></div>
</section>`);
}
const pairsHtml = pairPages.join("\n");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>SRF Power Machine CRM — Mobile Redesign</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  /* Same print document as the 18 Aug delivery report: the product's own
     palette, cobalt #1C50C8 from the client's mark on cool slate neutrals. */
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
    margin: 0; padding: 0;
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

  .cover { justify-content: center; background: var(--panel); }
  .cover .rule { width: 56mm; height: 3px; background: var(--cobalt); margin-bottom: 10mm; }
  .cover h1 { font-size: 30pt; font-weight: 600; letter-spacing: -0.02em; line-height: 1.1; margin: 0 0 5mm; }
  .cover .sub { font-size: 13pt; font-weight: 300; color: var(--ink-2); margin: 0 0 14mm; max-width: 150mm; }
  .cover dl { display: grid; grid-template-columns: 34mm 1fr; gap: 2.5mm 0; margin: 0; font-size: 10pt; }
  .cover dt {
    font-family: "IBM Plex Mono", monospace; font-size: 8pt; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--ink-3); padding-top: 1mm;
  }
  .cover dd { margin: 0; color: var(--ink); }

  .eyebrow {
    font-family: "IBM Plex Mono", monospace; font-size: 8pt; font-weight: 500;
    letter-spacing: 0.14em; text-transform: uppercase; color: var(--cobalt); margin: 0 0 3mm;
  }
  h2 {
    font-size: 17pt; font-weight: 600; letter-spacing: -0.015em;
    margin: 0 0 3mm; padding-bottom: 2.5mm; border-bottom: 2px solid var(--ink);
  }
  h3 { font-size: 11.5pt; font-weight: 600; margin: 0 0 1.5mm; }
  p { margin: 0 0 3mm; }
  .lede { color: var(--ink-2); max-width: 165mm; }

  /* The stat band, callouts and rule list went with the two analysis pages —
     see the note above the pairs below. Their CSS is gone with them rather than
     left behind as dead weight in a generated document. */

  /* ── Before / after pairs ──────────────────────────────────────────────
     Two per page. A phone frame is 390x844, so at 52mm wide each image is
     ~113mm tall; two rows plus captions land just inside the 267mm of usable
     page height. */
  .pair { page-break-inside: avoid; margin-bottom: 7mm; }
  .pair .change { font-size: 9pt; color: var(--ink-2); margin: 0 0 3mm; max-width: 170mm; }
  .shots { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
  .shots figure { margin: 0; }
  .shots img {
    width: 100%; display: block;
    border: 1px solid var(--line);
    border-radius: 2mm;
    background: var(--paper);
  }
  .shots figcaption { margin-top: 1.5mm; text-align: center; }
  .tag {
    font-family: "IBM Plex Mono", monospace; font-size: 7.5pt; font-weight: 600;
    letter-spacing: 0.1em; text-transform: uppercase;
    padding: 0.8mm 2.5mm; border-radius: 1mm;
  }
  .tag.before { color: var(--ink-2); background: var(--panel); border: 1px solid var(--line); }
  .tag.after  { color: var(--paper); background: var(--ok); }

  .foot {
    margin-top: auto; padding-top: 6mm; border-top: 1px solid var(--line-soft);
    font-size: 8pt; color: var(--ink-3);
    display: flex; justify-content: space-between;
  }
</style>
</head>
<body>

<!-- ── Cover ──────────────────────────────────────────────────────────── -->
<section class="page cover">
  <div class="rule"></div>
  <h1>Mobile redesign</h1>
  <p class="sub">
    The CRM rebuilt for the phone — every screen, before and after, captured from
    the running application at 390&times;844.
  </p>
  <dl>
    <dt>Client</dt><dd>SRF Power Machine</dd>
    <dt>Product</dt><dd>Generator Sales &amp; Service CRM</dd>
    <dt>Date</dt><dd>${today}</dd>
    <dt>Screens</dt><dd>${pairCount} compared</dd>
  </dl>
</section>

<!--
  ── Pairs, two to a printed page ─────────────────────────────────────────

  The document goes cover → comparisons, with no analysis pages in between.

  It previously carried a "The problem" page (four numbered faults, with the
  1500px / 1200px / 26px figures as a stat band) and an "The approach" page.
  Both were removed at the client's request: this is sent to them directly, and
  a document that opens by cataloguing what was wrong with what they were
  already using reads as an apology rather than a delivery. The comparisons make
  the same case on their own, and the reasoning lives in DESIGN.md where the
  team needs it.
-->
${pairsHtml}

</body>
</html>`;

fs.mkdirSync(SHOTS, { recursive: true });
fs.writeFileSync(OUT_HTML, html, "utf8");

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`file://${OUT_HTML.replace(/\\/g, "/")}`, { waitUntil: "networkidle" });
// Let the webfonts settle, or the first page renders in the fallback stack.
await page.waitForTimeout(1200);
await page.pdf({
  path: OUT_PDF,
  format: "A4",
  printBackground: true,
  margin: { top: "0", right: "0", bottom: "0", left: "0" },
});
await browser.close();

const kb = Math.round(fs.statSync(OUT_PDF).size / 1024);
console.log(`built ${OUT_PDF} (${kb} KB, ${pairCount} screen pairs)`);
