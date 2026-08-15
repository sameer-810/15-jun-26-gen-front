import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  onSubmit?: () => void;
  isPending?: boolean;
  submitLabel?: string;
  size?: "sm" | "md" | "lg" | "xl";
  error?: string | null;
  hideFooter?: boolean;
}

const sizeMap = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function FormDialog({
  open,
  onOpenChange,
  title,
  children,
  onSubmit,
  isPending,
  submitLabel = "Save",
  size = "md",
  error,
  hideFooter,
}: FormDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn("pg-overlay flex max-h-[90vh] w-full flex-col", sizeMap[size])}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {children}
        </div>

        {/* Footer */}
        {!hideFooter && (
          <div className="flex justify-end gap-3 border-t border-border px-6 py-4 shrink-0">
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            {onSubmit && (
              <button
                onClick={onSubmit}
                disabled={isPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
              >
                {isPending ? "Saving..." : submitLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
