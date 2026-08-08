import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, Search, X, FileText, FileSpreadsheet, Film, File as FileIcon } from "lucide-react";
import { FormDialog } from "@/modules/common/FormDialog";
import { useMediaList, useMediaFacets, useUploadMedia } from "../hooks/useMedia";
import { getApiErrorMessage } from "@/shared/api/http";
import { toast } from "@/shared/lib/toast";
import type { Media, MediaKind } from "../types";

/**
 * The "Attach Files" picker from Change Request point 17 — a category rail on
 * the left, kind tabs across the top, a thumbnail grid, and upload-from-computer.
 *
 * Used anywhere the CRM needs to attach an existing file: product images today,
 * WhatsApp templates and quotation attachments in Phase 5.
 */

const KIND_TABS: { key: MediaKind | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "image", label: "Images" },
  { key: "pdf", label: "PDF" },
  { key: "excel", label: "Excel" },
  { key: "doc", label: "Doc" },
  { key: "video", label: "Video" },
  { key: "other", label: "Others" },
];

const KIND_ICONS: Record<MediaKind, React.ComponentType<{ className?: string }>> = {
  image: FileIcon,
  pdf: FileText,
  excel: FileSpreadsheet,
  doc: FileText,
  video: Film,
  other: FileIcon,
};

/** Tags are stored lower-cased; show them title-cased. */
function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatSize(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the chosen files when the user confirms. */
  onSelect: (files: Media[]) => void;
  /** false → single-select (clicking a tile picks it and closes on confirm). */
  multiple?: boolean;
  /** Pre-selected ids, so re-opening the picker shows the current attachment. */
  initialSelectedIds?: string[];
  title?: string;
  /** Restrict the grid to one kind, e.g. "image" for a product gallery. */
  restrictKind?: MediaKind;
}

export function MediaPickerDialog({
  open,
  onOpenChange,
  onSelect,
  multiple = true,
  initialSelectedIds = [],
  title = "Attach Files",
  restrictKind,
}: Props) {
  const [kind, setKind] = useState<MediaKind | "all">(restrictKind ?? "all");
  const [category, setCategory] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Media[]>([]);
  const [uploadCategories, setUploadCategories] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useUploadMedia();
  const { data: facets } = useMediaFacets(open);
  const effectiveKind = restrictKind ?? (kind === "all" ? undefined : kind);
  const { data, isLoading } = useMediaList(
    {
      search: search.trim() || undefined,
      kind: effectiveKind,
      category: category || undefined,
      page: 1,
      limit: 60,
    },
    open,
  );

  const items = useMemo(() => data?.items ?? [], [data]);
  const selectedIds = useMemo(() => new Set(selected.map((f) => f.id)), [selected]);

  useEffect(() => {
    if (open) {
      setKind(restrictKind ?? "all");
      setCategory("");
      setCategorySearch("");
      setSearch("");
      setUploadCategories("");
      // Selection is seeded from the caller, but the full objects only arrive
      // with the list, so match them up once the page loads.
      setSelected([]);
    }
  }, [open, restrictKind]);

  useEffect(() => {
    if (!open || !initialSelectedIds.length || !items.length) return;
    setSelected((prev) => {
      if (prev.length) return prev;
      return items.filter((i) => initialSelectedIds.includes(i.id));
    });
  }, [open, items, initialSelectedIds]);

  const categories = useMemo(() => {
    const list = facets?.categories ?? [];
    const q = categorySearch.trim().toLowerCase();
    return q ? list.filter((c) => c.category.includes(q)) : list;
  }, [facets, categorySearch]);

  function toggle(file: Media) {
    setSelected((prev) => {
      const has = prev.some((f) => f.id === file.id);
      if (!multiple) return has ? [] : [file];
      return has ? prev.filter((f) => f.id !== file.id) : [...prev, file];
    });
  }

  async function onFilesChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow re-picking the same file
    if (!files.length) return;
    try {
      const uploaded: Media[] = [];
      for (const file of files) {
        uploaded.push(
          await uploadMutation.mutateAsync({
            file,
            categories: uploadCategories.trim() || undefined,
          }),
        );
      }
      // Newly uploaded files are almost always what the user wants attached.
      setSelected((prev) => (multiple ? [...prev, ...uploaded] : uploaded.slice(-1)));
      toast.success(`Uploaded ${uploaded.length} file(s)`);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  function confirm() {
    onSelect(selected);
    onOpenChange(false);
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="xl"
      onSubmit={confirm}
      isPending={uploadMutation.isPending}
      submitLabel={selected.length ? `Attach ${selected.length}` : "Attach"}
    >
      <div className="flex flex-col gap-4 md:flex-row" data-testid="media-picker">
        {/* Left rail — category filter */}
        <aside className="w-full shrink-0 space-y-3 md:w-56">
          <div className="rounded-lg border border-border p-3">
            <div className="mb-2 text-xs font-semibold text-muted-foreground">FILTERS</div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                aria-label="Search by category"
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                placeholder="Search by Category"
                className="w-full rounded-lg border border-input bg-background py-1.5 pl-7 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="mt-2 max-h-56 space-y-0.5 overflow-y-auto">
              <button
                type="button"
                onClick={() => setCategory("")}
                className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm transition-colors ${
                  category === "" ? "bg-primary/10 font-medium text-primary" : "hover:bg-accent"
                }`}
              >
                All categories
              </button>
              {categories.map((c) => (
                <button
                  key={c.category}
                  type="button"
                  data-testid={`media-category-${c.category}`}
                  onClick={() => setCategory(c.category)}
                  className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-sm transition-colors ${
                    category === c.category
                      ? "bg-primary/10 font-medium text-primary"
                      : "hover:bg-accent"
                  }`}
                >
                  <span className="truncate">{titleCase(c.category)}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{c.count}</span>
                </button>
              ))}
              {categories.length === 0 && (
                <p className="px-2 py-1 text-xs text-muted-foreground">No categories yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border p-3">
            <label
              className="mb-1 block text-xs font-semibold text-muted-foreground"
              htmlFor="media-upload-categories"
            >
              TAGS FOR NEW UPLOADS
            </label>
            <input
              id="media-upload-categories"
              value={uploadCategories}
              onChange={(e) => setUploadCategories(e.target.value)}
              placeholder="Portable Generator, Bajaj"
              className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Comma-separated. Applied to files you upload below.
            </p>
          </div>
        </aside>

        {/* Right pane — tabs, search, grid */}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                aria-label="Search files"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search files by name or tag..."
                className="w-full rounded-lg border border-input bg-background py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <input
              ref={fileRef}
              type="file"
              multiple={multiple}
              onChange={onFilesChosen}
              className="hidden"
              data-testid="media-file-input"
              accept="image/*,application/pdf,.xlsx,.xls,.csv,.doc,.docx,video/mp4"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploadMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {uploadMutation.isPending ? "Uploading..." : "Upload from Computer"}
            </button>
          </div>

          {!restrictKind && (
            <div className="flex flex-wrap gap-1 border-b border-border">
              {KIND_TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setKind(t.key)}
                  className={`-mb-px border-b-2 px-3 py-1.5 text-sm font-medium transition-colors ${
                    kind === t.key
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5" data-testid="media-selection">
              {selected.map((f) => (
                <span
                  key={f.id}
                  className="inline-flex max-w-[180px] items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                >
                  <span className="truncate">{f.filename}</span>
                  <button
                    type="button"
                    onClick={() => toggle(f)}
                    aria-label={`Remove ${f.filename}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="min-h-[280px] max-h-[45vh] overflow-y-auto rounded-lg border border-border p-3">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : items.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No files here yet. Use “Upload from Computer” to add one.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {items.map((f) => {
                  const isSelected = selectedIds.has(f.id);
                  const Icon = KIND_ICONS[f.kind] ?? FileIcon;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => toggle(f)}
                      data-testid={`media-tile-${f.id}`}
                      aria-pressed={isSelected}
                      title={f.filename}
                      className={`group overflow-hidden rounded-lg border text-left transition-all ${
                        isSelected
                          ? "border-primary ring-2 ring-primary/40"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex h-24 items-center justify-center bg-muted/40">
                        {f.kind === "image" ? (
                          <img
                            src={f.thumbnailUrl}
                            alt={f.filename}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Icon className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <div className="p-1.5">
                        <div className="truncate text-[11px] font-medium text-foreground">
                          {f.filename}
                        </div>
                        <div className="truncate text-[10px] text-muted-foreground">
                          {formatSize(f.sizeBytes)}
                          {f.categories.length ? ` · ${titleCase(f.categories[0])}` : ""}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {facets && (
            <p className="text-[11px] text-muted-foreground">
              Storage: {facets.provider} · max {facets.maxUploadMb} MB per file
            </p>
          )}
        </div>
      </div>
    </FormDialog>
  );
}
