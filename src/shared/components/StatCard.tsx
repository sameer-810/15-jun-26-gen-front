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
    <div className={cn("pg-panel px-4 py-3.5", className)}>
      <p className="truncate text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 font-mono text-[1.6rem] font-semibold leading-none tracking-tight tabular-nums",
          TONE_VALUE[tone],
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-2 text-xs font-light text-muted-foreground">{hint}</p>}
    </div>
  );
}
