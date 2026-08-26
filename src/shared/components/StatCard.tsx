import { cn } from "@/lib/utils";

/**
 * A single headline figure.
 *
 * Three rules hold this component to the palette discipline in DESIGN.md, and
 * breaking any of them re-introduces the generic admin-template KPI card:
 *
 * 1. **No icon tile.** Colour in this product means status, so it is never
 *    spent on a decorative glyph beside the label.
 * 2. **The figure is mono + tabular.** These sit in a row and get compared to
 *    each other; proportional digits make that harder.
 * 3. **`tone` is an exception channel.** A stat is plain by default and takes
 *    colour only when the number itself is the alarm — overdue follow-ups,
 *    stock below minimum.
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
