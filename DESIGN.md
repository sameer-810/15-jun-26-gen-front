# Design direction — SRF Power Machine CRM

The client said the product looks machine-made. This file is the response: a set
of rules that can be checked, so the interface stops drifting toward the median
admin template.

It is written for **internal software**, which is a different problem from a
marketing site. Most "AI look" advice — kill the cards, kill the icons, break the
grid — is wrong here. A CRM is a tool. The rules below come from what actually
distinguishes good enterprise software, researched 14 Aug 2026.

---

## The governing principle

> **Density with discipline beats decoration.**

Linear is the benchmark: the highest information density on screen with the
lowest visual noise. Enterprise users are not browsing, they are working. Every
pixel spent on ornament is a pixel not spent on a lead, a quotation line or a
stock figure.

**Test before shipping any change:** does it help someone find a number faster,
or does it just look nicer in a screenshot? If it is the second, revert it.

---

## Typography — where this product actually wins

Research is unambiguous on enterprise type: **a humanist sans for the interface,
a monospace for data**, because numbers need fixed-width characters to line up
and compare. Weight ladder: 300 secondary data · 400 body · 500 interactive ·
600–700 headings.

- **UI — `IBM Plex Sans`.** Humanist, designed by IBM specifically for enterprise
  software, weights 300–700. Replaces Inter, which is the single most-produced
  interface font in generated work and carries no signal at all.
- **Data — `IBM Plex Mono`.** A designed companion to the above, not a fallback.

### Why the mono matters more than it sounds

The codebase already used `tabular-nums` in 14 places and `font-mono` in 15 —
someone had the right instinct — but **no mono family was ever declared in
`tailwind.config.js`**. So `font-mono` fell through to Tailwind's default stack:
Consolas on Windows, Menlo on macOS, something else again on Linux. Quotation
totals, GST figures and kVA ratings rendered differently on every machine in the
office, in a product whose entire job is numbers.

**Rules:**

- Every currency amount, quantity, kVA rating, percentage, date, invoice number,
  lot code and ID is set in `font-mono` with `tabular-nums`. No exceptions.
- Secondary/derived figures use weight 300, not a lighter grey. Colour carries
  meaning here (status); weight carries hierarchy.
- Never use a third family.

## Colour

The palette is already correct and derived from the client's own mark — cobalt
`#1C50C8` from the logo, on cool slate neutrals. It is kept.

- **Cobalt is for interaction only** — primary actions, active nav, focus rings,
  links. It must never be decoration. If cobalt appears somewhere unclickable,
  it is wrong.
- **Status colour is functional and reserved**: success, warning, destructive.
  Never use a status colour for emphasis.
- No gradients as decoration. No coloured glow shadows (`shadow-primary/25`).
- Dark mode is a first-class surface, not an afterthought — field staff use this
  on phones at sites.

## Shape and surface

- `rounded-lg` on interactive chrome (buttons, inputs, nav items) — already the
  convention here, and correct.
- **`rounded-2xl` + `shadow-xl` is banned.** That is the untouched shadcn card.
  Cards in a data product are containers, not objects: a hairline border and a
  background shift, no elevation.
- Shadow is reserved for things that genuinely float above the page: dropdowns,
  popovers, the command palette, dialogs, mobile drawers.

### The three surface primitives

Every panel in the app is one of these. If a screen needs a fourth, the screen
is wrong, not the list. Defined in `index.css`.

| Class         | Use                                        | Elevation    |
| ------------- | ------------------------------------------ | ------------ |
| `.pg-panel`   | Any in-page container (tables, stat cards) | none         |
| `.pg-tile`    | As above, padded — prose or a chart        | none         |
| `.pg-overlay` | Genuinely floats: dialog, menu, palette    | `shadow-2xl` |

Elevation is a **signal that something is modal to the page**, not a texture. An
in-page panel that reaches for a shadow is claiming to float when it doesn't.

## Effects that are banned outright

These were all present, and together they were the reason the client said the
product looked machine-made. They are removed and must not come back:

- **Gradient text** (`pg-gradient-text`, cobalt→sky). A measurement is not a
  brand moment.
- **Glassmorphism** (`pg-glass`). Also a real cost: table rows scrolling under a
  blurred bar read as moving smears, and it forces a compositing layer on every
  scroll frame in a table-heavy product.
- **Ambient blurred glow** (`pg-glow`) behind headers.
- **Animated aurora blobs** (`pg-aurora-*`).
- **Hover-lift** (`pg-lift`, `-translate-y` + shadow) on cards. Cards are not
  buttons; only things that respond to a click should move under the cursor.
- **Fade-and-rise on page mount.** ~200ms before the first number is readable,
  on a screen someone opens forty times a day. The only remaining animation is
  `animate-overlay-in` — a 120ms opacity fade for things that genuinely appear
  over the page.
- **Decorative icon tiles** — a pastel-tinted rounded square holding a glyph
  next to a KPI label. It spends a _colour_ on ornament in a product where
  colour is supposed to mean status.

## Colour discipline, restated as a test

A stat, badge or row is **neutral by default** and coloured only when the value
itself is the signal — overdue, below minimum, lost. If every tile on a screen
is coloured, none of them reads as urgent, and the one that actually needs
attention is camouflaged by the four that don't.

## Layout

- **Do not redesign the shell.** `Sidebar.tsx`, `Topbar.tsx` and `AppLayout.tsx`
  are a competent, conventional CRM frame — collapsible rail, role-filtered menu,
  command palette, breadcrumbs. That convention is what makes the tool learnable.
  Changing it for novelty makes the product worse.
- Tables are the primary surface. Optimise for scanning: aligned numeric columns,
  sticky headers, no zebra striping (it fights the eye at density), row hover.
- **The leftmost column is the anchor** — it is what tells you which record you
  are looking at, and in this CRM that is the customer name. `Actions` used to
  occupy it on every list screen, so every row opened with the same identical
  pair of buttons and the name was pushed to second place. Actions go last,
  after the data you read in order to decide whether to act.
- **The header stays pinned.** The body scrolls inside the panel. On a 50-row
  page across ten columns, losing the column names after the eighth row is the
  biggest single cost in a table this wide.
- Row actions are quiet icon buttons, labelled for screen readers. Fifty rows
  each carrying a red filled "Delete" trains people to stop seeing red as
  dangerous; the confirm dialog is the real safeguard, so the button can be
  calm and only turn destructive on hover.
- **The whole row opens the record** (`rowHref`, or `rowOpensEditor` where there
  is no detail route). This is an _enhancement layered on a real anchor_, never
  a replacement for one — the identifying cell keeps its `<a href>` so keyboard
  users, screen readers and "copy link address" all still work.

  Row activation must stand down in three cases, and all three are covered by
  `e2e/row-click.spec.ts`:

  1. the click landed on something interactive (`INTERACTIVE_SELECTOR`, with
     `[data-row-ignore]` as the escape hatch for anything unusual);
  2. **text is selected** — staff drag across cells to copy mobile numbers and
     GST figures, and the click fires on mouseup at the end of that drag;
  3. it was a modifier or middle click, which must open a new tab instead.

  A row that opens a record when someone meant to copy a phone number is worse
  than a row that never opened at all.

- Role-based views. A sales user should not have to look past inventory columns.

## Login page

The one screen that genuinely reads as a template, and the only one being
rebuilt outright. Rules:

- **The submit button is never disabled while the user is typing.** Disabling it
  preemptively is a documented anti-pattern: the user cannot tell which rule they
  have failed. Validate on submit and show the error. Disabled is acceptable only
  when every field is untouched.
- **No stock photography.** `login-bg.jpg` was a self-hosted Unsplash image doing
  the brand's job. The identity is the mark, the cobalt and the type.
- No `rounded-2xl … shadow-xl` card floating on grey.
- Copy names the business and the work. "The modern way to run a generator sales
  & service business" could be any product; delete that sentence class.

## Motion

- Transitions on colour and transform only, 150–200ms. No fade-and-rise on
  mount.
- Nothing animates on a data table. Rows appearing with a stagger is a
  screenshot feature and a usability cost.
