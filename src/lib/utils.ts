import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | undefined | null): string {
  if (amount == null) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * A rupee figure short enough for a half-width stat tile.
 *
 * `formatCurrency` gives "₹23,45,000.00" — thirteen mono glyphs, wider than the
 * ~171px a two-up tile has on a 390px screen, so the value wrapped mid-number
 * and read as "₹23,45,000.0 / 0". Lakh and crore are how this figure is spoken
 * in the office anyway, so the short form is not a compromise for small screens;
 * it is the more natural unit, and the exact number is one tap away on the
 * screen the tile links to.
 *
 * Deliberately *not* used in tables, quotations or invoices: those are
 * reconciliation figures and must stay exact to the paisa.
 */
export function formatCurrencyCompact(amount: number | undefined | null): string {
  if (amount == null) return "₹0";
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  // Indian grouping, so the thresholds are crore (10^7) and lakh (10^5).
  if (abs >= 1_00_00_000) return `${sign}₹${trimZeroes(abs / 1_00_00_000)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${trimZeroes(abs / 1_00_000)}L`;
  if (abs >= 1_000) return `${sign}₹${trimZeroes(abs / 1_000)}K`;
  return `${sign}₹${Math.round(abs)}`;
}

/** One decimal, but only when it says something — 23.5 stays, 23.0 becomes 23. */
function trimZeroes(n: number): string {
  return n.toFixed(1).replace(/\.0$/, "");
}

/** Up to two initials, for the identity disc on a mobile record card. */
export function initialsOf(name: string | undefined): string {
  return (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
}

export function formatDate(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
