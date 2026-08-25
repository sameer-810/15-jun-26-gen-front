import { cn } from "@/lib/utils";

/**
 * A single headline figure.
 *
 * Rebuilt away from the pastel-icon-in-a-rounded-square KPI card, which is the
 * most reproduced component in generated admin UI. Three things changed and
 * each one is a judgement, not a taste:
 *
 * 1. **The icon tile is gone.** A wallet glyph next to "Open Pipeline" tells a
 *    salesperson nothing they didn't get from the label — it existed to fill
 *    the corner. Worse, it spent a *colour* (emerald, amber, sky) on decoration
 *    in a product where colour is supposed to mean status. Someone glancing at
 *    an amber tile should think "something needs attention", not "this is the
 *    follow-ups box".
 *
 * 2. **The figure is mono.** These four values sit in a row and get compared to
 *    each other and to yesterday's. Proportional digits make that harder for no
 *    reason. Same reasoning as every currency cell in the tables.
 *
 * 3. **`tone` now drives the value's colour, and only when it earns it.** It is
 *    an *exception* channel: a stat is plain by default and coloured only when
 *    the number itself is the alarm — overdue follow-ups, stock below minimum.
 */
interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  /**
   * Reserved for a figure that is itself a signal. Leave unset for a neutral
   * measurement — most stats are neutral, and a wall of coloured numbers means
   * none of them reads as urgent.
   */
  tone?: "neutral" | "success" | "warning" | "danger";
  className?: string;
}

const TONE_VALUE: Record<NonNullable<StatCardProps["tone"]>, string> = {
  neutral: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
};

export function StatCard({ label, value, hint, tone = "neutral", className }: StatCardProps) {
  return (
    <div className={cn("pg-panel px-3 py-3 md:px-4 md:py-3.5", className)}>
      {/*
        `break-words` rather than `truncate` on the label: two-up on a phone the
        tile is ~171px, and "Sales This Month" truncated to "Sales This M…" is a
        worse trade than a second line. The label is the part that says what the
        number means.
      */}
      <p className="break-words text-[11px] font-medium uppercase leading-tight tracking-[0.06em] text-muted-foreground md:truncate md:text-xs md:tracking-[0.08em]">
        {label}
      </p>
      {/*
        The figure steps down to 1.25rem on a phone. At 1.6rem a formatted rupee
        amount — ₹23,45,000.00, fourteen mono glyphs — is wider than a half-width
        tile and spilled past its own border.
      */}
      <p
        className={cn(
          "mt-1.5 break-all font-mono text-xl font-semibold leading-none tracking-tight tabular-nums md:mt-2 md:break-normal md:text-[1.6rem]",
          TONE_VALUE[tone],
        )}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-1.5 text-[11px] font-light leading-tight text-muted-foreground md:mt-2 md:text-xs">
          {hint}
        </p>
      )}
    </div>
  );
}
