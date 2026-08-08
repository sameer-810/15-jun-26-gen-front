import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { useProductOptions } from "../hooks/useProducts";
import { formatCurrency } from "@/lib/utils";
import type { ProductOption } from "../types";

/**
 * Searchable catalog dropdown for a quotation line item — Change Request
 * point 4 ("in quotation description should auto fill from drop down").
 *
 * Deliberately a button + popover rather than a `<select>`: the descriptions
 * are multi-line (point 5's sample runs a dozen lines) and each option needs a
 * thumbnail and price, none of which a native select can render. Free text
 * stays available — the caller keeps its own textarea alongside this.
 */

interface Props {
  onSelect: (option: ProductOption) => void;
  /** Rendered inside the trigger button. */
  label?: string;
  className?: string;
  "data-testid"?: string;
}

export function ProductPicker({
  onSelect,
  label = "Pick from catalog",
  className,
  "data-testid": testId,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: options, isLoading } = useProductOptions(search, open);

  // Close on outside click / Escape, the way a native select would.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function choose(option: ProductOption) {
    onSelect(option);
    setOpen(false);
    setSearch("");
  }

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        data-testid={testId}
        className="flex w-full items-center justify-between gap-1 rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm transition hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <span className="truncate text-muted-foreground">{label}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div
          role="listbox"
          data-testid="product-picker-menu"
          // Anchored to the trigger's RIGHT edge so the menu opens inward.
          // Anchoring left made a 420px menu hang off a 176px trigger and
          // pushed the whole dialog into horizontal scroll.
          className="absolute right-0 z-50 mt-1 w-[min(420px,70vw)] rounded-lg border border-border bg-card shadow-xl"
        >
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search the catalog..."
                aria-label="Search the catalog"
                className="w-full rounded-md border border-input bg-background py-1.5 pl-7 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto p-1">
            {isLoading ? (
              <div className="flex justify-center py-6">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : !options?.length ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                {search ? "No matching products." : "The catalog is empty."}
              </p>
            ) : (
              options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => choose(o)}
                  data-testid={`product-option-${o.id}`}
                  className="flex w-full items-center gap-2.5 rounded-md p-2 text-left transition-colors hover:bg-accent"
                >
                  {o.primaryImageUrl ? (
                    <img
                      src={o.primaryImageUrl}
                      alt=""
                      loading="lazy"
                      className="h-9 w-9 shrink-0 rounded border border-border object-cover"
                    />
                  ) : (
                    <div className="h-9 w-9 shrink-0 rounded border border-border bg-muted/40" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">{o.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {[o.brand, o.modelCode, o.kva ? `${o.kva} kVA` : null]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs">
                    <div className="font-semibold text-foreground">{formatCurrency(o.price)}</div>
                    {o.unit && <div className="text-muted-foreground">/{o.unit}</div>}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
