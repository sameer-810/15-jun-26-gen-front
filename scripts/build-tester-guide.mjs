/**
 * Builds the tester's guide: user stories with step-by-step checks, written for
 * someone new to the product.
 *
 *   node scripts/build-tester-guide.mjs
 *
 * Written for SRF's live portal, which is already in daily use. So testers use
 * their own name and number as the customer, every story that creates
 * something is covered by the clean-up checklist at the end, and anything that
 * cannot be undone on live books — raising or issuing a tax invoice, locking a
 * colleague's login, punching in as someone else — is a look-only check or
 * limited to the tester's own account.
 *
 * A working document, not a showcase: no screenshots, printed, ticked and
 * handed back. Same palette and typefaces as the other SRF documents.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const ROOT = path.resolve(".");
const OUT_PDF = path.resolve(ROOT, "..", "SRF_CRM_Tester_Guide.pdf");
const OUT_HTML = path.join(ROOT, "report-shots", "tester-guide.html");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** `**bold**` in story text, for button and screen names. */
const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");

const ROLES = {
  any: "Any login",
  admin: "Administrator",
  manager: "Sales Manager",
  sales: "Sales Executive",
  inventory: "Inventory Manager",
};

/* ── The stories ─────────────────────────────────────────────────────────── */

const MODULES = [
  {
    code: "A",
    title: "Signing in and what each login can see",
    intro: "Start here. Every other section assumes you can sign in with each of SRF's logins.",
    stories: [
      {
        id: "A1",
        role: "any",
        prio: "Must",
        title: "Sign in",
        want: "sign in with my work email",
        so: "I can reach my work",
        steps: [
          "Open the portal link in Chrome.",
          "Type the email and password.",
          "Click **Sign in**.",
        ],
        expect: ["The Dashboard opens.", "The account's name and role show at the top right."],
      },
      {
        id: "A2",
        role: "sales",
        prio: "Must",
        title: "A wrong password is refused",
        want: "a wrong password to be rejected",
        so: "nobody can guess their way in",
        steps: [
          "Enter the Sales Executive email with a wrong password, once.",
          "Click **Sign in**.",
        ],
        expect: ["An error message appears.", "You stay on the sign-in page."],
      },
      {
        id: "A3",
        role: "sales",
        prio: "Must",
        title: "Sales Executive sees the sales menu",
        want: "only the menu items my job needs",
        so: "the screen is not cluttered",
        steps: ["Sign in as Sales Executive.", "Read the menu on the left."],
        expect: [
          "Visible: Dashboard, Leads, Capacity Calculator, Quotations & PI, Product Catalog, Inventory, Sales, My Performance, Reports, Activity Log, Templates.",
          "Not visible: Locations, Attendance & Targets, Settings, Users.",
        ],
      },
      {
        id: "A4",
        role: "inventory",
        prio: "Must",
        title: "Inventory Manager sees the stock menu",
        want: "only stock-related screens",
        so: "I don't see customer leads",
        steps: ["Sign in as Inventory Manager.", "Read the menu on the left."],
        expect: [
          "Visible: Dashboard, Product Catalog, Inventory, Sales, My Performance, Reports, Activity Log, Templates, Locations.",
          "Not visible: Leads, Capacity Calculator, Quotations & PI, Attendance & Targets, Settings, Users.",
        ],
      },
      {
        id: "A5",
        role: "any",
        prio: "Must",
        title: "Log out",
        want: "log out on a shared computer",
        so: "the next person can't use my login",
        steps: [
          "Click the name at the top right.",
          "Click **Log out**.",
          "Press the browser Back button.",
        ],
        expect: ["The sign-in page shows.", "Back does not show any customer data."],
      },
    ],
  },
  {
    code: "L",
    title: "Leads",
    intro:
      "A lead is an enquiry from a possible customer. Most arrive from IndiaMART automatically; walk-ins are added by hand. In this section you are the customer: use your own name and mobile.",
    stories: [
      {
        id: "L1",
        role: "sales",
        prio: "Must",
        title: "Add a walk-in lead",
        want: "add a customer who walked in",
        so: "I can follow them up",
        steps: [
          "Go to **Leads** and click **New Lead**.",
          "Customer Name: your own name. Mobile: your own number. City: your city.",
          "Requirement: 62.5 kVA silent genset. Required KVA: 62.5. Source: Walk-in.",
          "Save. Then repeat once with your name followed by “2”, so you have two leads for L7.",
        ],
        expect: [
          "Your leads are at the top of the list.",
          "Received shows today's date and the time.",
          "Status is New.",
        ],
      },
      {
        id: "L2",
        role: "sales",
        prio: "Must",
        title: "Find a lead",
        want: "narrow the list quickly",
        so: "I find the right customer",
        steps: [
          "In **Search**, type your name.",
          "Try **Status**, **Source**, **Calls** (All / Answered / Unanswered / Not called) and **Received between**.",
          "Clear the filters.",
        ],
        expect: [
          "The list and the record count change with each filter.",
          "Clearing brings everything back.",
        ],
      },
      {
        id: "L3",
        role: "sales",
        prio: "Must",
        title: "Open a lead",
        want: "see everything about a customer in one place",
        so: "I'm prepared before calling",
        steps: ["Click anywhere on your lead's row."],
        expect: [
          "The lead page opens with the name, status and mobile number.",
          "Buttons: Manage Lead, WhatsApp, Email, Log Call, Calculate, Quote, Convert.",
          "Tabs: Overview, History, Documents.",
        ],
      },
      {
        id: "L4",
        role: "sales",
        prio: "Must",
        title: "Log a call",
        want: "record whether the customer picked up",
        so: "the team knows who was reached",
        steps: [
          "On your lead, click **Log Call**.",
          "Choose an **Outcome** (Connected, No answer, Busy, Wrong number or Callback requested) and write a **Note**.",
          "Save.",
        ],
        expect: [
          "The Calls counter goes up by 1.",
          "The History tab shows the call with the account's name.",
          "In Leads, the Calls filter shows it under Answered for Connected, and under Unanswered for the other outcomes.",
        ],
      },
      {
        id: "L5",
        role: "sales",
        prio: "Must",
        title: "Change a lead's status",
        want: "mark how far a lead has got",
        so: "the pipeline stays accurate",
        steps: [
          "On your lead, click **Manage Lead**.",
          "Under LEAD STATUS click **Contacted**.",
          "If the team already has labels, select one. Don't create new labels while testing: everyone sees them.",
          "Click **Save**.",
        ],
        expect: ["The status chip reads Contacted.", "Any label you selected shows on the lead."],
      },
      {
        id: "L6",
        role: "sales",
        prio: "Should",
        title: "Add a note",
        want: "write down what the customer said",
        so: "anyone can pick up the conversation",
        steps: ["On your lead: **Manage Lead** → ADD NOTES → type a note → **Save Note**."],
        expect: ["The note appears in the lead's History."],
      },
      {
        id: "L7",
        role: "manager",
        prio: "Must",
        title: "Assign leads to a salesperson",
        want: "share leads out across the team",
        so: "every enquiry has an owner",
        steps: [
          "In Leads, tick your two leads from L1.",
          "Click **Assign to…** and choose Sales Executive.",
          "Sign in as Sales Executive.",
        ],
        expect: [
          "Sales Executive sees both leads.",
          "Sales Executive does not see leads assigned to other people.",
        ],
      },
      {
        id: "L8",
        role: "admin",
        prio: "Must",
        title: "Delete one lead",
        want: "remove a single wrong lead",
        so: "the list stays clean",
        steps: [
          "In Leads, scroll the table to the far right.",
          "On your second lead's row, click the bin icon.",
          "Read the message, then confirm.",
        ],
        expect: [
          "The message names the lead and says it moves to the Recycle Bin.",
          "The lead leaves the list and appears in **Recycle Bin**.",
        ],
      },
      {
        id: "L9",
        role: "admin",
        prio: "Must",
        title: "Bulk delete works only on dead leads",
        want: "clear out many dead leads at once, without deleting live ones by mistake",
        so: "real enquiries are safe",
        steps: [
          "Tick only your first lead (status New). Hover over **Delete selected**. Don't click it.",
          "Untick it. Nothing else needs to change.",
        ],
        expect: [
          "With a New lead ticked, **Delete selected** is greyed out and explains that only Not Interested or Irrelevant leads can be deleted.",
        ],
      },
      {
        id: "L10",
        role: "manager",
        prio: "Must",
        title: "Restore a deleted lead",
        want: "undo a delete",
        so: "a mistake costs nothing",
        steps: [
          "Leads → **Recycle Bin**.",
          "Find your second lead and read how many days it has left.",
          "Click **Restore**.",
        ],
        expect: [
          "The lead is back in Leads with its details intact.",
          "As Sales Manager you see Restore, but not “Delete for good”.",
        ],
      },
      {
        id: "L11",
        role: "admin",
        prio: "Should",
        title: "Delete a lead for good",
        want: "remove a lead permanently before its 7 days are up",
        so: "junk doesn't wait a week",
        steps: [
          "Delete your second lead again (as in L8).",
          "Recycle Bin → **Delete** on it → **Delete for good**.",
        ],
        expect: ["The lead is gone from the Recycle Bin and cannot be restored."],
      },
      {
        id: "L12",
        role: "admin",
        prio: "Should",
        title: "Import leads from Excel",
        want: "load a list of leads at once",
        so: "I don't type them one by one",
        steps: [
          "Leads → **Import Leads** → **Download template**.",
          "Fill 2 rows with your name plus “import 1” and “import 2”, and your number. Leave a required column empty in a third row.",
          "Upload the file.",
        ],
        expect: [
          "2 leads are added.",
          "The third row is listed under “Rows that were skipped” with the reason.",
        ],
      },
    ],
  },
  {
    code: "R",
    title: "Reminders and the reminder pop-up",
    intro:
      "A reminder pops up at the time you set, on whatever screen you're on. It checks every 30 seconds, so allow up to half a minute after the time.",
    stories: [
      {
        id: "R1",
        role: "sales",
        prio: "Must",
        title: "Set a reminder",
        want: "be reminded to call a customer back",
        so: "I don't forget",
        steps: [
          "Open your lead from L1 → **Manage Lead**.",
          "Under SET REMINDER FOR, choose **Pick date and time**: 2 minutes from now.",
          "Reminder note: call back. Click **Set Reminder**.",
        ],
        expect: [
          "A message confirms the reminder and its time.",
          "The lead shows it under UPCOMING REMINDERS.",
        ],
      },
      {
        id: "R2",
        role: "sales",
        prio: "Must",
        title: "The pop-up appears at the time",
        want: "to be interrupted when it's time to call",
        so: "the call actually happens",
        steps: [
          "Go to a different screen, for example Product Catalog.",
          "Wait until the reminder time.",
        ],
        expect: [
          "Within 30 seconds a card appears at the bottom right.",
          "It shows your name, mobile, the note and the time.",
          "A short sound plays, and the browser tab title starts with “(1) Reminder”.",
        ],
      },
      {
        id: "R3",
        role: "sales",
        prio: "Must",
        title: "Mark it done",
        want: "close a reminder once I've called",
        so: "it stops appearing",
        steps: ["On the card, click **Done**."],
        expect: ["The card closes.", "Dashboard → My Reminders no longer lists it."],
      },
      {
        id: "R4",
        role: "sales",
        prio: "Must",
        title: "Snooze it",
        want: "push a reminder back a little",
        so: "I can finish what I'm doing first",
        steps: [
          "Set another reminder on your lead 2 minutes ahead.",
          "When the card appears, click **Snooze 10 min**.",
        ],
        expect: [
          "The card closes.",
          "Dashboard → My Reminders shows the time moved 10 minutes later.",
          "The card appears again 10 minutes later. Click **Done** then.",
        ],
      },
      {
        id: "R5",
        role: "sales",
        prio: "Should",
        title: "Closing it means later, not never",
        want: "close the card without losing the reminder",
        so: "a stray click doesn't lose a call",
        steps: ["When a card appears, click the **×** on it.", "Wait 10 minutes."],
        expect: [
          "The card closes.",
          "It comes back after about 10 minutes, because it isn't done. Click **Done** then.",
        ],
      },
      {
        id: "R6",
        role: "sales",
        prio: "Should",
        title: "A form stays usable while a reminder is showing",
        want: "keep working in a form when a reminder arrives",
        so: "I don't lose what I'm typing",
        steps: [
          "Set a reminder on your lead 2 minutes ahead.",
          "Open **New Lead** and wait until the time. Try the form's buttons, then click **Cancel** without saving.",
        ],
        expect: [
          "The form stays on top and all its buttons work.",
          "The reminder card is visible after you close the form.",
        ],
      },
      {
        id: "R7",
        role: "sales",
        prio: "Should",
        title: "Desktop alert when the tab is in the background",
        want: "be alerted even while I'm in another browser tab",
        so: "I still see it",
        steps: [
          "On any reminder card, click **Allow desktop alerts** and allow it in the browser.",
          "Set a reminder on your lead 2 minutes ahead, then switch to a different browser tab.",
        ],
        expect: [
          "A system notification “Reminder: <name>” appears.",
          "Clicking it opens that lead.",
        ],
      },
      {
        id: "R8",
        role: "manager",
        prio: "Should",
        title: "The reminder goes to the lead's owner",
        want: "set a reminder for the person responsible for a lead",
        so: "the right person calls",
        steps: [
          "As Sales Manager, set a reminder 2 minutes ahead on your lead assigned to Sales Executive in L7.",
          "Have Sales Executive signed in on another computer or browser.",
        ],
        expect: ["The pop-up appears for Sales Executive, not for Sales Manager."],
      },
      {
        id: "R9",
        role: "inventory",
        prio: "Should",
        title: "No reminder pop-ups for inventory staff",
        want: "not be interrupted by sales reminders",
        so: "I can do stock work",
        steps: ["Sign in as Inventory Manager and use the portal for a few minutes."],
        expect: ["No reminder card ever appears."],
      },
      {
        id: "R10",
        role: "sales",
        prio: "Should",
        title: "Reminder on a phone",
        want: "get reminders on my phone",
        so: "I can call from the site",
        steps: [
          "Sign in on a phone and set a reminder on your lead 2 minutes ahead.",
          "Wait with the portal open.",
        ],
        expect: [
          "The card appears above the bottom menu.",
          "Its **Call** button opens the phone dialler.",
        ],
      },
    ],
  },
  {
    code: "Q",
    title: "Quotations, proforma invoices and tax invoices",
    intro:
      "Never click Raise tax invoice or Issue invoice while testing. A tax invoice takes SRF's next GST invoice number the moment it is created, and that number can't be given back.",
    stories: [
      {
        id: "Q1",
        role: "sales",
        prio: "Must",
        title: "Raise a quotation from a lead",
        want: "quote straight from an enquiry",
        so: "I don't retype the customer",
        steps: [
          "In Leads, click **Quote** on your lead.",
          "Check your name and number are already filled in.",
          "Line items: **Pick from catalog** → the BAJAJ 3900PS generator.",
          "Click **Create**.",
        ],
        expect: [
          "“Document created” appears, with the next quotation number (QTN-…).",
          "The lead's **Documents** tab lists it.",
        ],
      },
      {
        id: "Q2",
        role: "sales",
        prio: "Must",
        title: "GST inside the state",
        want: "GST split into CGST and SGST for a local customer",
        so: "the document is legally right",
        steps: [
          "Quotations & PI → **New Quotation**. Customer name: your name.",
          "One item: Rate 35000, Qty 1, Disc % 0, GST % 18. Leave **Inter-state (IGST)** unticked.",
          "Create, then **View PDF**.",
        ],
        expect: [
          "Taxable 35,000 and Grand Total 41,300.",
          "The PDF shows CGST 3,150 and SGST 3,150.",
        ],
      },
      {
        id: "Q3",
        role: "sales",
        prio: "Must",
        title: "GST for another state",
        want: "IGST for an out-of-state customer",
        so: "the document is legally right",
        steps: ["Same as Q2, but tick **Inter-state (IGST)**.", "Create, then **View PDF**."],
        expect: [
          "The form shows IGST 6,300 and Grand Total 41,300.",
          "The PDF shows IGST only, with no CGST or SGST.",
        ],
      },
      {
        id: "Q4",
        role: "sales",
        prio: "Must",
        title: "Discount",
        want: "give a discount on a line",
        so: "the totals reflect the deal",
        steps: [
          "New Quotation with the same item as Q2 and **Disc %** 10. Check the totals, then **Cancel** without creating.",
        ],
        expect: ["Taxable 31,500.", "GST 5,670.", "Grand Total 37,170."],
      },
      {
        id: "Q5",
        role: "sales",
        prio: "Must",
        title: "The quotation PDF is complete",
        want: "a professional PDF",
        so: "the customer trusts it",
        steps: ["On your quotation from Q1, click **View PDF**."],
        expect: [
          "SRF's business name, address and GSTIN at the top.",
          "The item with its HSN code, and an HSN / Tax Summary.",
          "The amount in words matches the Grand Total.",
          "Terms and conditions are printed.",
        ],
      },
      {
        id: "Q6",
        role: "sales",
        prio: "Should",
        title: "Build a quotation from the catalog",
        want: "the quickest route to a quotation",
        so: "I can quote while on the phone",
        steps: [
          "Quotations & PI → **Build from catalog**.",
          "Enter your name as the customer, select a product, **Next**, then **Quick Generate**.",
        ],
        expect: ["A quotation is created with the product's price and description."],
      },
      {
        id: "Q7",
        role: "sales",
        prio: "Should",
        title: "Fill a returning customer's details",
        want: "reuse details from the last document",
        so: "the GSTIN and address are right",
        steps: [
          "New Quotation. Type your own mobile number (used in Q1).",
          "Click **Auto-fetch from last document**, check what fills in, then **Cancel**.",
        ],
        expect: ["Name, address and state fill in from your last quotation."],
      },
      {
        id: "Q8",
        role: "manager",
        prio: "Must",
        title: "Create a proforma invoice",
        want: "send an advance bill",
        so: "the customer can pay against it",
        steps: [
          "New Quotation with **Type** Proforma Invoice, customer: your name → **Create**.",
          "Open the **Proforma Invoices** tab and find it.",
          "Look for **Raise tax invoice** on its row, but do not click it.",
        ],
        expect: [
          "The proforma gets a PI number (PI-…).",
          "The Raise tax invoice option is offered on it.",
        ],
      },
      {
        id: "Q9",
        role: "manager",
        prio: "Must",
        title: "An issued tax invoice is locked (look only)",
        want: "issued invoices to be unchangeable",
        so: "SRF's GST records can't be altered",
        steps: [
          "Only once SRF has issued a real tax invoice. Skip this if the Tax Invoices tab is empty.",
          "Open an issued invoice's actions. Look for Edit and Delete, but do not change anything.",
        ],
        expect: [
          "It is marked Issued.",
          "It cannot be edited, and deleting it is refused with a message to raise a credit note instead.",
        ],
      },
      {
        id: "Q10",
        role: "admin",
        prio: "Should",
        title: "Delete a draft quotation",
        want: "remove a wrong draft",
        so: "the list stays tidy",
        steps: ["On each quotation and proforma you created, choose **Delete** and confirm."],
        expect: ["The message warns it cannot be undone.", "Each one is removed."],
      },
    ],
  },
  {
    code: "W",
    title: "Sending to the customer on WhatsApp and email",
    intro: "Send only to your own phone number and email address.",
    stories: [
      {
        id: "W1",
        role: "sales",
        prio: "Must",
        title: "Send a quotation on WhatsApp",
        want: "send the quotation on WhatsApp",
        so: "the customer has it immediately",
        steps: [
          "Before Q10, open your lead from L1 (its mobile is your own number).",
          "Click **WhatsApp**. Choose a template. Under **Attach a document** pick your quotation from Q1.",
          "Click **Prepare & Open**, then press send in WhatsApp.",
        ],
        expect: [
          "WhatsApp opens with the message and a link.",
          "In your chat, the link shows a card with the generator photo, the quotation number and the total.",
        ],
      },
      {
        id: "W2",
        role: "sales",
        prio: "Must",
        title: "The customer opens the link",
        want: "the customer to open the quotation without an account",
        so: "there's no friction",
        steps: [
          "Open the link from W1 in a private or incognito window, where you're not signed in.",
        ],
        expect: [
          "A page shows the photo, items and total.",
          "**View the full quotation (PDF)** opens the PDF without asking for a login.",
        ],
      },
      {
        id: "W3",
        role: "sales",
        prio: "Must",
        title: "Template picture without a document",
        want: "show the generator picture even when I don't attach a quotation",
        so: "the message looks professional",
        steps: [
          "On your lead, click **WhatsApp** and choose the template “3.9 kva generator”.",
          "Leave **Attach a document** on “— No document —”.",
          "Read the note under the picture, then **Prepare & Open** and send to yourself.",
        ],
        expect: [
          "The note says “Your customer sees this picture as a preview card above the message.”",
          "The message ends with a link, and your chat shows a card with the template's picture.",
          "Tapping the card shows the picture, each point on its own line, and a Call button.",
        ],
      },
      {
        id: "W4",
        role: "sales",
        prio: "Should",
        title: "Most-used template in one tap",
        want: "the template I use most offered first",
        so: "sending is quick",
        steps: [
          "Open **WhatsApp** on your lead, look at the templates, then close without sending.",
        ],
        expect: [
          "Once templates have been sent, the most-used one is offered as a one-tap button.",
          "A deleted template is never offered.",
        ],
      },
      {
        id: "W5",
        role: "sales",
        prio: "Should",
        title: "Send by email",
        want: "email the quotation",
        so: "customers who prefer email get it",
        steps: [
          "On your lead click **Email**, type your own email address, attach your quotation, click **Prepare & Open**.",
        ],
        expect: [
          "Your mail app opens with the subject, message and a secure link to the quotation.",
        ],
      },
      {
        id: "W6",
        role: "sales",
        prio: "Should",
        title: "WhatsApp from an iPhone",
        want: "send from an iPhone",
        so: "iPhone users on the team aren't stuck",
        steps: ["Repeat W1 in Safari on an iPhone, sending to yourself."],
        expect: ["WhatsApp opens with the message ready to send."],
      },
    ],
  },
  {
    code: "C",
    title: "Product catalog, inventory, sales and locations",
    intro:
      "Everything you add here is seen by SRF's staff, so give it a name that says it's yours and remove it afterwards.",
    stories: [
      {
        id: "C1",
        role: "admin",
        prio: "Must",
        title: "Add a catalog product with a picture",
        want: "add a generator to the catalog",
        so: "it can be quoted in two clicks",
        steps: [
          "**Product Catalog** → **New Product**.",
          "Product Name: Demo 5 kVA – your name. Brand, KVA 5, Price, GST % 18, HSN Code.",
          "SPECIFICATIONS → **Add spec** (e.g. Cooling System: Air). IMAGES → **Choose images**, mark one Primary.",
          "Keep it **Active** and save.",
        ],
        expect: [
          "It is listed with its picture, price and spec count.",
          "It appears in **Pick from catalog** on a new quotation.",
        ],
      },
      {
        id: "C2",
        role: "inventory",
        prio: "Must",
        title: "Add a stock item",
        want: "record generators in stock",
        so: "sales know what's available",
        steps: [
          "**Inventory** → **New Model**.",
          "Model: DEMO and your initials, KVA 5, a Location, Opening Stock Qty 3, Low-stock Alert At 1.",
          "Save.",
        ],
        expect: ["It is listed with quantity 3 and its location."],
      },
      {
        id: "C3",
        role: "inventory",
        prio: "Should",
        title: "Add more stock",
        want: "top up stock when a delivery arrives",
        so: "numbers stay right",
        steps: [
          "On your DEMO model click **Stock**, enter **Quantity to add** 2, click **Add Stock**.",
        ],
        expect: ["The quantity becomes 5."],
      },
      {
        id: "C4",
        role: "sales",
        prio: "Must",
        title: "Convert a lead into a sale",
        want: "record that the customer bought",
        so: "stock and figures update",
        steps: [
          "Open your lead from L1 → **Convert**.",
          "Generator Model: your DEMO model, Quantity 1, Sale Total → **Convert to Sale**.",
        ],
        expect: [
          "The lead's status becomes Converted.",
          "The sale is listed under **Sales**.",
          "Your DEMO model's stock in Inventory goes down by 1.",
        ],
      },
      {
        id: "C5",
        role: "sales",
        prio: "Should",
        title: "Can't sell what isn't in stock",
        want: "to be stopped selling a model with no stock",
        so: "we don't promise what we don't have",
        steps: [
          "Create a second DEMO model with Opening Stock Qty 0 (as in C2).",
          "On a new lead with your name (as in L1), try **Convert** with it.",
        ],
        expect: [
          "The message “Out of stock — add stock first.” appears and the sale is not saved.",
        ],
      },
      {
        id: "C6",
        role: "manager",
        prio: "Should",
        title: "Record a sale directly",
        want: "record a counter sale with no lead",
        so: "every sale is counted",
        steps: [
          "**Sales** → **Record Sale**. Model: your DEMO model, Quantity 1, Customer Name: your name, a Location.",
          "Billing: **With GST** → **Record Sale**.",
        ],
        expect: [
          "The sale is listed.",
          "The Dashboard's Sales This Month and the GST vs Non-GST chart include it.",
        ],
      },
      {
        id: "C7",
        role: "manager",
        prio: "Should",
        title: "Void a sale",
        want: "cancel a sale entered by mistake",
        so: "the figures stay right",
        steps: ["Void each sale you recorded in C4 and C6: click **Void** and confirm."],
        expect: [
          "Each sale is voided and no longer counted in Sales This Month.",
          "Its quantity goes back into your DEMO model's stock.",
        ],
      },
      {
        id: "C8",
        role: "admin",
        prio: "Should",
        title: "Add a location",
        want: "add a branch or godown",
        so: "stock and sales can be tagged with it",
        steps: ["**Locations** → **New Location** → Name: Demo yard – your name, Active → save."],
        expect: ["It appears in the Location dropdowns in Inventory, Sales and the Leads filter."],
      },
    ],
  },
  {
    code: "K",
    title: "Capacity calculator",
    intro:
      "Recommends the generator size for a customer's appliances. Nothing here is saved, so test freely.",
    stories: [
      {
        id: "K1",
        role: "sales",
        prio: "Must",
        title: "Size a typical load",
        want: "work out the right generator size",
        so: "I quote the right machine",
        steps: [
          "**Capacity Calculator** → **Pick an appliance to add…**",
          "Add the closest matches for: 1 refrigerator, 2 × 1.5-ton air conditioners, 10 lights.",
        ],
        expect: [
          "A **Recommended Generator** size in kVA shows, with running and peak load.",
          "“Largest start-up surge from:” names the air conditioner.",
          "For this load the recommendation is about 25 kVA.",
        ],
      },
      {
        id: "K2",
        role: "sales",
        prio: "Must",
        title: "Quote the sizing",
        want: "turn the result into a quotation",
        so: "I don't retype it",
        steps: [
          "After K1, click **Quote this sizing** (or **Create Quotation**). Look, then **Cancel** without creating.",
        ],
        expect: ["A quotation form opens carrying the recommended size."],
      },
      {
        id: "K3",
        role: "sales",
        prio: "Should",
        title: "Add an appliance that isn't in the chart",
        want: "size a machine the chart doesn't list",
        so: "unusual sites can be sized",
        steps: ["Type Submersible pump, Running W 750, Starting W 2250 → **Add appliance**."],
        expect: ["The pump is included and the recommendation updates."],
      },
    ],
  },
  {
    code: "H",
    title: "Attendance, targets and pay",
    intro:
      "Attendance drives real pay. Punch in and out only with your own staff account, never with someone else's login. A full day is 7.5 hours, and a half day is 4 hours.",
    stories: [
      {
        id: "H1",
        role: "any",
        prio: "Must",
        title: "Punch in",
        want: "record when I start work",
        so: "my attendance and pay are right",
        steps: [
          "Signed in with your own staff account, click **Punch in** at the top of the screen.",
          "Allow the camera, **Take photo**, confirm.",
        ],
        expect: [
          "The button changes to **Punch out**.",
          "The administrator sees your punch-in time and photo.",
        ],
      },
      {
        id: "H2",
        role: "any",
        prio: "Must",
        title: "Punch out",
        want: "record when I finish",
        so: "my hours are counted",
        steps: ["At the end of your day, click **Punch out** and take the photo."],
        expect: ["Your hours for the day are recorded."],
      },
      {
        id: "H3",
        role: "manager",
        prio: "Must",
        title: "See the team's attendance",
        want: "see who came in and when",
        so: "I can manage the team",
        steps: ["**Attendance & Targets** → Employee: Everyone → choose the Month."],
        expect: ["Each person's days, punch-in and punch-out times are listed."],
      },
      {
        id: "H4",
        role: "manager",
        prio: "Should",
        title: "Record approved leave",
        want: "mark sanctioned leave",
        so: "it is paid correctly",
        steps: [
          "Only for your own staff account: **Approved leave** → First day, Last day, Reason → **Mark leave**.",
          "Check the result, then click **Remove leave**.",
        ],
        expect: [
          "Those days show as leave and count as paid days.",
          "After Remove leave, they're gone again.",
        ],
      },
      {
        id: "H5",
        role: "manager",
        prio: "Should",
        title: "Fix a forgotten punch-out",
        want: "close a day where someone forgot to punch out",
        so: "their pay is right",
        steps: [
          "Only when a real day needs it, agreed with that person. Skip this story otherwise.",
          "Click **Settle this day**, enter **Punched out at** → **Settle**.",
        ],
        expect: ["The day is resolved and its hours count."],
      },
      {
        id: "H6",
        role: "manager",
        prio: "Must",
        title: "See a monthly target",
        want: "track a salesperson against a target",
        so: "progress is visible",
        steps: [
          "Use a target SRF has actually set. Don't add test targets to real people.",
          "Sign in as that salesperson and open **My Performance**.",
        ],
        expect: ["The target shows under Targets with how much has been achieved."],
      },
      {
        id: "H7",
        role: "any",
        prio: "Must",
        title: "See my own performance",
        want: "see my attendance, earnings and targets",
        so: "I know where I stand",
        steps: ["Open **My Performance**."],
        expect: [
          "Payable Days, Gross Earned, Incentive, Total, Units Sold and Targets are shown for the month.",
        ],
      },
      {
        id: "H8",
        role: "admin",
        prio: "Should",
        title: "Only the last 4 Aadhaar digits are stored",
        want: "staff Aadhaar numbers not kept in full",
        so: "personal data is protected",
        steps: [
          "Only on your own user record: **Users** → Edit → Aadhaar: type 12 digits and try to save.",
          "Then type only the last 4 digits and save.",
        ],
        expect: ["12 digits are refused.", "4 digits are accepted."],
      },
    ],
  },
  {
    code: "P",
    title: "Dashboard, reports and activity",
    intro: "",
    stories: [
      {
        id: "P1",
        role: "manager",
        prio: "Must",
        title: "Dashboard figures move",
        want: "live business figures at a glance",
        so: "I spot problems early",
        steps: ["Note Open Pipeline before you start L1.", "After L1, refresh the Dashboard."],
        expect: ["Open Pipeline has gone up by the leads you added."],
      },
      {
        id: "P2",
        role: "admin",
        prio: "Must",
        title: "Only the administrator can download data",
        want: "exports restricted to administrators",
        so: "customer lists can't walk out of the company",
        steps: [
          "As Administrator: **Reports** → choose From and To → **Export Excel**.",
          "Sign in as Sales Manager, then as Sales Executive, and look for Export Excel on Reports, Product Catalog and Inventory.",
        ],
        expect: [
          "The Administrator gets an Excel file.",
          "Nobody else sees an Export Excel button anywhere.",
        ],
      },
      {
        id: "P3",
        role: "manager",
        prio: "Should",
        title: "Activity log shows who did what",
        want: "a record of actions",
        so: "I can see what happened and who did it",
        steps: ["After the stories above, open **Activity Log**."],
        expect: [
          "Your lead created, call logged, reminder set and quotation created are listed with a name and time.",
        ],
      },
      {
        id: "P4",
        role: "any",
        prio: "Should",
        title: "Jump anywhere with search",
        want: "open any screen or record from the keyboard",
        so: "I move quickly",
        steps: ["Press **Ctrl + K**, type a screen name or your lead's name, press Enter."],
        expect: ["That screen or lead opens."],
      },
    ],
  },
  {
    code: "S",
    title: "Settings and staff accounts",
    intro:
      "Administrator only. These change the live portal for everyone, so every check here is look-only.",
    stories: [
      {
        id: "S1",
        role: "admin",
        prio: "Should",
        title: "Company details print on documents",
        want: "our details on every PDF",
        so: "documents are correct",
        steps: [
          "**Settings** → Company: read the business name, address, GSTIN and bank details.",
          "Open your quotation's PDF (before Q10).",
        ],
        expect: ["The PDF shows exactly the details in Settings."],
      },
      {
        id: "S2",
        role: "admin",
        prio: "Must",
        title: "Document numbering",
        want: "to see the next document numbers",
        so: "invoices follow a clean series",
        steps: ["**Settings** → Document Numbering. Look only; don't change the numbers."],
        expect: [
          "“Next will be” is shown for Quotation, Proforma Invoice and Tax Invoice, with the current financial year for invoices.",
        ],
      },
      {
        id: "S3",
        role: "admin",
        prio: "Should",
        title: "WhatsApp preview picture",
        want: "a picture on WhatsApp cards for documents without a product photo",
        so: "every share looks professional",
        steps: [
          "**Settings** → look at the WhatsApp preview picture currently set.",
          "Share a quotation with no product picture to your own phone.",
        ],
        expect: ["The WhatsApp card shows that picture."],
      },
      {
        id: "S4",
        role: "admin",
        prio: "Must",
        title: "Staff accounts and roles",
        want: "each staff login to have the right role",
        so: "people see only what their job needs",
        steps: ["Open **Users** and read the list. Don't add or change accounts while testing."],
        expect: ["SRF's accounts are listed with the correct role for each person."],
      },
    ],
  },
  {
    code: "M",
    title: "On a phone",
    intro: "Use a real phone, not a desktop browser made narrow.",
    stories: [
      {
        id: "M1",
        role: "sales",
        prio: "Must",
        title: "Phone layout",
        want: "use the portal comfortably on my phone",
        so: "I can work from site",
        steps: ["Sign in on a phone and open Leads."],
        expect: [
          "The menu is at the bottom, with tabs and More.",
          "Leads show as cards.",
          "Nothing scrolls sideways.",
        ],
      },
      {
        id: "M2",
        role: "sales",
        prio: "Must",
        title: "Call and WhatsApp from a lead card",
        want: "reach a customer in one tap",
        so: "I'm quick in the field",
        steps: ["On your own lead's card, tap **Call**, then come back and tap **WhatsApp**."],
        expect: ["Call opens the dialler with your number.", "WhatsApp opens the send screen."],
      },
      {
        id: "M3",
        role: "sales",
        prio: "Should",
        title: "Filters on a phone",
        want: "filter leads on a phone",
        so: "I find the right one",
        steps: ["Tap **Filters**, choose a Status, close the panel."],
        expect: ["The Filters button shows how many filters are on.", "The list is filtered."],
      },
      {
        id: "M4",
        role: "admin",
        prio: "Should",
        title: "Delete a lead on a phone",
        want: "remove a wrong lead from my phone",
        so: "I don't need a computer",
        steps: ["On one of your own lead cards tap **More** → **Delete lead** → confirm."],
        expect: ["The lead moves to the Recycle Bin."],
      },
    ],
  },
  {
    code: "X",
    title: "Safety checks",
    intro: "",
    stories: [
      {
        id: "X1",
        role: "sales",
        prio: "Must",
        title: "Admin screens can't be used by typing the address",
        want: "admin screens protected even from typed addresses",
        so: "settings and staff data stay private",
        steps: [
          "Signed in as Sales Executive, type the portal address followed by /settings, then /users. Don't save anything.",
        ],
        expect: [
          "The staff accounts list does not load.",
          "Any attempt to save a company setting is refused with an error.",
        ],
      },
      {
        id: "X2",
        role: "any",
        prio: "Should",
        title: "A changed customer link is refused",
        want: "altered links to fail",
        so: "nobody can open other customers' documents",
        steps: ["Copy the link from W1, change its last few characters, and open it."],
        expect: ["The page says “This link is not valid” and shows no document."],
      },
    ],
  },
];

/** Everything the stories create on the live portal, and how to remove it. */
const CLEANUP = [
  [
    "Your leads (L1, L12, C5)",
    "Leads → bin icon on each row → then Recycle Bin → Delete → Delete for good.",
  ],
  [
    "Your quotations and proforma invoices (Q1–Q8)",
    "Quotations & PI → Delete on each one (story Q10).",
  ],
  ["Your reminders (R1–R10)", "Click Done on each card, or on Dashboard → My Reminders."],
  ["Sales you recorded (C4, C6)", "Sales → Void on each one (story C7)."],
  ["Your DEMO stock models (C2, C5)", "Inventory → Delete on each, after its sales are voided."],
  ["Your demo catalog product (C1)", "Product Catalog → Delete."],
  ["Your demo location (C8)", "Locations → Delete, after the DEMO stock using it is gone."],
  ["Leave you marked (H4)", "Attendance & Targets → Remove leave."],
];

/* ── Rendering ───────────────────────────────────────────────────────────── */

const total = MODULES.reduce((n, m) => n + m.stories.length, 0);
const mustCount = MODULES.reduce(
  (n, m) => n + m.stories.filter((s) => s.prio === "Must").length,
  0,
);

/** "As a sales executive" / "As an administrator" / "As any staff member". */
function asWho(role) {
  if (role === "any") return "As <b>any staff member</b>";
  const name = ROLES[role].toLowerCase();
  return `As ${/^[aeiou]/.test(name) ? "an" : "a"} <b>${name}</b>`;
}

function story(s) {
  return `
  <article class="story">
    <header>
      <span class="id">${s.id}</span>
      <h4>${esc(s.title)}</h4>
      <span class="role">${ROLES[s.role]}</span>
      <span class="prio ${s.prio.toLowerCase()}">${s.prio}</span>
    </header>
    <p class="as">${asWho(s.role)}, I want to ${esc(s.want)}, so that ${esc(s.so)}.</p>
    <div class="cols">
      <div>
        <p class="label">Steps</p>
        <ol>${s.steps.map((x) => `<li>${rich(x)}</li>`).join("")}</ol>
      </div>
      <div>
        <p class="label">Expected result</p>
        <ul>${s.expect.map((x) => `<li>${rich(x)}</li>`).join("")}</ul>
      </div>
    </div>
    <footer><span class="box"></span> Pass <span class="box"></span> Fail <span class="notes">Notes:</span></footer>
  </article>`;
}

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>SRF Power Machine CRM — Tester Guide</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --ink:#0f1b2d; --ink-2:#4a5a70; --ink-3:#7c8ca3; --line:#d7dee8; --line-soft:#e9eef4;
    --cobalt:#1c50c8; --cobalt-bg:#edf2fd; --ok:#047857; --warn:#b45309; --warn-bg:#fdf3e3; --panel:#f7f9fc;
  }
  * { box-sizing:border-box; }
  html, body { margin:0; color:var(--ink); font-family:"IBM Plex Sans",system-ui,sans-serif;
    font-size:9.6pt; line-height:1.45; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  h1,h2,h3,h4 { margin:0; letter-spacing:-.01em; }
  b { font-weight:600; }
  .mono { font-family:"IBM Plex Mono",monospace; }

  .break { break-before:page; }

  .cover { height:257mm; display:flex; flex-direction:column; justify-content:center; }
  .cover .rule { width:56mm; height:3px; background:var(--cobalt); margin-bottom:10mm; }
  .cover h1 { font-size:30pt; font-weight:600; line-height:1.1; margin-bottom:5mm; }
  .cover .sub { font-size:13pt; font-weight:300; color:var(--ink-2); margin:0 0 14mm; max-width:150mm; }
  .cover dl { display:grid; grid-template-columns:34mm 1fr; gap:3mm 6mm; margin:0; font-size:10.5pt; }
  .cover dt { color:var(--ink-3); } .cover dd { margin:0; }

  .eyebrow { font-size:8pt; letter-spacing:.12em; text-transform:uppercase; color:var(--cobalt); font-weight:600; margin:0 0 2mm; }
  h2 { font-size:17pt; font-weight:600; margin-bottom:3mm; }
  h3 { font-size:11pt; font-weight:600; margin:6mm 0 2mm; }
  .lede { font-size:10.5pt; color:var(--ink-2); margin:0 0 5mm; max-width:170mm; }
  p { margin:0 0 2.5mm; }

  table.grid { width:100%; border-collapse:collapse; margin:2mm 0 4mm; font-size:9.2pt; }
  table.grid th { text-align:left; font-size:7.8pt; letter-spacing:.06em; text-transform:uppercase; color:var(--ink-2);
    border-bottom:1px solid var(--line); padding:0 3mm 1.5mm 0; font-weight:600; }
  table.grid td { border-bottom:1px solid var(--line-soft); padding:1.6mm 3mm 1.6mm 0; vertical-align:top; }
  table.grid td.id { font-family:"IBM Plex Mono",monospace; font-weight:500; white-space:nowrap; }

  .callout { border-left:3px solid var(--warn); background:var(--warn-bg); padding:3mm 4mm; margin:3mm 0 4mm; border-radius:0 4px 4px 0; }
  .callout p:last-child { margin:0; }

  ol.plain, ul.plain { margin:0 0 3mm; padding-left:5mm; } ol.plain li, ul.plain li { margin-bottom:1.2mm; }

  .bugform { border:1px solid var(--line); border-radius:4px; padding:3mm 4mm; }
  .bugform div { display:grid; grid-template-columns:38mm 1fr; border-bottom:1px dashed var(--line); padding:2.2mm 0; }
  .bugform div:last-child { border-bottom:0; }
  .bugform span { color:var(--ink-2); }

  .module-head { margin-bottom:4mm; }
  .module-head .intro { color:var(--ink-2); margin:0; }

  .story { break-inside:avoid; border:1px solid var(--line); border-radius:4px; padding:2.6mm 3.4mm 2mm; margin:0 0 3mm; }
  .story header { display:flex; align-items:baseline; gap:2.5mm; margin-bottom:1mm; }
  .story .id { font-family:"IBM Plex Mono",monospace; font-weight:600; color:var(--cobalt); min-width:8mm; }
  .story h4 { font-size:10.2pt; font-weight:600; flex:1; }
  .story .role { font-size:7.8pt; color:var(--ink-2); border:1px solid var(--line); border-radius:3px; padding:.3mm 1.6mm; white-space:nowrap; }
  .story .prio { font-size:7.8pt; font-weight:600; border-radius:3px; padding:.3mm 1.6mm; }
  .story .prio.must { color:#fff; background:var(--ink); }
  .story .prio.should { color:var(--ink-2); background:var(--line-soft); }
  .story .as { color:var(--ink-2); font-style:italic; margin:0 0 1.6mm; }
  .story .cols { display:grid; grid-template-columns:1.05fr 1fr; gap:5mm; }
  .story .label { font-size:7.6pt; letter-spacing:.08em; text-transform:uppercase; color:var(--ink-3); font-weight:600; margin:0 0 .8mm; }
  .story ol, .story ul { margin:0; padding-left:4.2mm; }
  .story li { margin-bottom:.7mm; }
  .story footer { display:flex; align-items:center; gap:1.6mm; margin-top:1.6mm; padding-top:1.4mm; border-top:1px solid var(--line-soft); font-size:8.6pt; color:var(--ink-2); }
  .box { display:inline-block; width:3.2mm; height:3.2mm; border:1px solid var(--ink-2); border-radius:.6mm; margin-left:2mm; }
  .box:first-child { margin-left:0; }
  .notes { margin-left:5mm; flex:1; border-bottom:1px dotted var(--ink-3); padding-bottom:.4mm; }

  table.sheet td { height:6.4mm; }
  table.sheet td.tick { width:14mm; }
  table.sheet td.note { width:62mm; }
</style>
</head>
<body>

<section class="cover">
  <div class="rule"></div>
  <h1>Tester Guide</h1>
  <p class="sub">User stories with step-by-step checks for the SRF Power Machine CRM. Written for someone using the system for the first time, on SRF's live portal.</p>
  <dl>
    <dt>Product</dt><dd>SRF Power Machine — Sales &amp; Service CRM</dd>
    <dt>Checks</dt><dd><span class="mono">${total}</span> stories in ${MODULES.length} areas, <span class="mono">${mustCount}</span> marked Must</dd>
    <dt>Portal</dt><dd class="mono">srf.fiveminfotech.com</dd>
    <dt>Date</dt><dd>16 September 2026</dd>
  </dl>
</section>

<section class="break">
  <p class="eyebrow">Start here</p>
  <h2>How to use this guide</h2>
  <p class="lede">Each card is one <b>user story</b>: something a real person does in the CRM. You play that person, follow the steps, and check that what happens matches the expected result.</p>

  <h3>For every story</h3>
  <ol class="plain">
    <li>Sign in with the login shown on the card (for example <b>Sales Executive</b>).</li>
    <li>Follow the steps in order. Words in <b>bold</b> are the exact button or screen names.</li>
    <li>Compare what you see with <b>Expected result</b>. Every point must be true.</li>
    <li>Tick <b>Pass</b> if all of it is true. Otherwise tick <b>Fail</b> and write what was different.</li>
    <li>For every Fail, fill in a bug report (next page) and take a screenshot.</li>
  </ol>

  <h3>Do the Must stories first</h3>
  <p>Stories marked <b>Must</b> are the daily work of the business. If you only have one day, test those. <b>Should</b> stories cover less frequent situations.</p>

  <div class="callout">
    <p><b>This is SRF's live portal.</b> SRF's staff are using it, and everything you create is real and visible to them.</p>
  </div>
  <ul class="plain">
    <li>Be the customer yourself: use <b>your own name and your own mobile number</b> in every story. Never type or message a real customer.</li>
    <li>Remove what you create. The <b>clean-up checklist</b> near the end lists everything the stories add.</li>
    <li><b>Never click Raise tax invoice or Issue invoice.</b> Tax invoice numbers are part of SRF's GST records and can't be taken back.</li>
    <li>Punch in and out only with <b>your own staff account</b>. Attendance decides real pay.</li>
    <li>If a screen looks stuck, refresh the page once before reporting it.</li>
  </ul>

  <h3>SRF's logins</h3>
  <p>These are SRF's own accounts, already handed over. The stories say which one to use. Get the passwords from SRF's administrator; they aren't written here, because documents get forwarded.</p>
  <table class="grid">
    <thead><tr><th>Role</th><th>Email</th><th>What it can do</th></tr></thead>
    <tbody>
      <tr><td>Administrator</td><td class="mono">admin@srfpowermachine.com</td><td>Everything, including Settings, Users, exports and deleting</td></tr>
      <tr><td>Sales Manager</td><td class="mono">manager@srfpowermachine.com</td><td>Leads, quotations, assigning leads, attendance and targets</td></tr>
      <tr><td>Sales Executive</td><td class="mono">sales@srfpowermachine.com</td><td>Own leads, quotations, sending, calls, reminders</td></tr>
      <tr><td>Inventory Manager</td><td class="mono">inventory@srfpowermachine.com</td><td>Catalog, stock, sales, locations</td></tr>
    </tbody>
  </table>
</section>

<section class="break">
  <p class="eyebrow">Before you start</p>
  <h2>Words you will see</h2>
  <table class="grid">
    <tbody>
      <tr><td><b>Lead</b></td><td>An enquiry from a possible customer. Most arrive automatically from IndiaMART.</td></tr>
      <tr><td><b>Quotation</b></td><td>A price offer sent to the customer. Numbered QTN-1001, QTN-1002…</td></tr>
      <tr><td><b>Proforma invoice (PI)</b></td><td>An advance bill the customer can pay against. Numbered PI-5001…</td></tr>
      <tr><td><b>Tax invoice</b></td><td>The legal GST bill. Numbered per financial year, e.g. INV/2026-27/0001. Locked once issued.</td></tr>
      <tr><td><b>GST, CGST, SGST, IGST</b></td><td>Inside the same state, GST is split in half as CGST + SGST. To another state it is charged as IGST.</td></tr>
      <tr><td><b>HSN</b></td><td>The government code for the type of product, printed on every GST document.</td></tr>
      <tr><td><b>kVA</b></td><td>The size of a generator. The capacity calculator recommends one.</td></tr>
      <tr><td><b>Template</b></td><td>Saved message or description text, reused when sending or quoting.</td></tr>
      <tr><td><b>Recycle Bin</b></td><td>Where deleted leads wait for 7 days before they are removed for good.</td></tr>
      <tr><td><b>Punch in / out</b></td><td>Starting and ending the work day, with a photo. It drives attendance and pay.</td></tr>
    </tbody>
  </table>

  <p class="eyebrow" style="margin-top:8mm">When something fails</p>
  <h2>Bug report</h2>
  <p class="lede">Copy this for every Fail. A bug that can be repeated can be fixed.</p>
  <div class="bugform">
    <div><span>Story ID</span><b></b></div>
    <div><span>Login used</span><b></b></div>
    <div><span>Computer or phone, browser</span><b></b></div>
    <div><span>Steps I followed</span><b></b></div>
    <div><span>What I expected</span><b></b></div>
    <div><span>What actually happened</span><b></b></div>
    <div><span>Screenshot attached</span><b>Yes / No</b></div>
  </div>
</section>

${MODULES.map(
  (m) => `
<section class="break">
  <div class="module-head">
    <p class="eyebrow">Section ${m.code}</p>
    <h2>${esc(m.title)}</h2>
    ${m.intro ? `<p class="intro">${esc(m.intro)}</p>` : ""}
  </div>
  ${m.stories.map(story).join("")}
</section>`,
).join("")}

<section class="break">
  <p class="eyebrow">Before you hand this back</p>
  <h2>Clean-up checklist</h2>
  <p class="lede">Remove everything you created, in this order, so SRF's portal is left exactly as you found it.</p>
  <table class="grid">
    <thead><tr><th>Done</th><th>What you created</th><th>How to remove it</th></tr></thead>
    <tbody>
      ${CLEANUP.map(([what, how]) => `<tr><td class="tick"><span class="box"></span></td><td><b>${esc(what)}</b></td><td>${esc(how)}</td></tr>`).join("")}
    </tbody>
  </table>
</section>

<section class="break">
  <p class="eyebrow">Hand this back</p>
  <h2>Results sheet</h2>
  <p class="lede">One line per story. Tester: ______________________ &nbsp; Date: ______________</p>
  <table class="grid sheet">
    <thead><tr><th>ID</th><th>Story</th><th>Priority</th><th>Pass</th><th>Fail</th><th>Notes</th></tr></thead>
    <tbody>
      ${MODULES.flatMap((m) => m.stories)
        .map(
          (s) =>
            `<tr><td class="id">${s.id}</td><td>${esc(s.title)}</td><td>${s.prio}</td><td class="tick"><span class="box"></span></td><td class="tick"><span class="box"></span></td><td class="note"></td></tr>`,
        )
        .join("")}
    </tbody>
  </table>
</section>

</body>
</html>`;

fs.mkdirSync(path.dirname(OUT_HTML), { recursive: true });
fs.writeFileSync(OUT_HTML, html, "utf8");

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("file://" + OUT_HTML.replace(/\\/g, "/"), { waitUntil: "networkidle" });
// Give the webfonts a moment; a PDF that falls back to Times looks wrong.
await page.waitForTimeout(1200);
await page.pdf({
  path: OUT_PDF,
  format: "A4",
  printBackground: true,
  margin: { top: "16mm", right: "15mm", bottom: "16mm", left: "15mm" },
  displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate: `<div style="width:100%;font-family:system-ui,sans-serif;font-size:7.5pt;color:#7c8ca3;padding:0 15mm;display:flex;justify-content:space-between">
      <span>SRF Power Machine CRM · Tester Guide</span>
      <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
    </div>`,
});
await browser.close();

const kb = Math.round(fs.statSync(OUT_PDF).size / 1024);
console.log(`wrote ${OUT_PDF} (${kb} KB) — ${total} stories, ${mustCount} Must`);
