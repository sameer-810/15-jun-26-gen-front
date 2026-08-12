import { useState } from "react";
import { Plus, Pencil, Trash2, Star, ImagePlus, X } from "lucide-react";
import { FormDialog } from "@/modules/common/FormDialog";
import { MediaPickerDialog } from "@/modules/media/components/MediaPickerDialog";
import {
  useTemplates,
  useTemplateMeta,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  TEMPLATE_KIND_LABELS,
  TEMPLATE_KINDS,
} from "../hooks/useMessaging";
import { useAppSelector } from "@/app/hooks";
import { getApiErrorMessage } from "@/shared/api/http";
import { toast } from "@/shared/lib/toast";
import { PageLoader } from "@/shared/components/PageLoader";
import type { Media } from "@/modules/media/types";
import type { Template, TemplateKind } from "../types";

/**
 * "One section to create the required templates for email, WhatsApp and others
 * (description and T&C)" — change request (11 Aug) point 4, and the IndiaMART
 * example asking for a template with an image and a full description that can
 * be renamed and edited.
 */

const inputCls =
  "w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition";

const KIND_HELP: Record<TemplateKind, string> = {
  description: "Offered in the quotation line item, next to the catalog picker.",
  terms:
    "Offered as a Terms & Conditions preset on quotations and invoices. One condition per line.",
  whatsapp: "Offered when sending a WhatsApp message. May carry an image.",
  email: "Offered when sending an email. Has a subject line.",
};

export function TemplatesPage() {
  const role = useAppSelector((s) => s.auth.user?.role);
  const canEdit = role === "admin" || role === "manager";

  const [kind, setKind] = useState<TemplateKind>("description");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Template | null>(null);

  const { data, isLoading } = useTemplates({ kind, limit: 100 });
  const { data: meta } = useTemplateMeta();
  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();
  const deleteMutation = useDeleteTemplate();

  // Editor state
  const [form, setForm] = useState({
    name: "",
    subject: "",
    body: "",
    categories: "",
    isDefault: false,
    isActive: true,
  });
  const [image, setImage] = useState<Media | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  function openEditor(template: Template | null) {
    setEditing(template);
    setForm({
      name: template?.name ?? "",
      subject: template?.subject ?? "",
      body: template?.body ?? "",
      categories: (template?.categories ?? []).join(", "),
      isDefault: template?.isDefault ?? false,
      isActive: template?.isActive ?? true,
    });
    setImage(
      template?.imageUrl
        ? ({
            id: template.imageId ?? "",
            url: template.imageUrl,
            thumbnailUrl: template.imageUrl,
            filename: "image",
          } as Media)
        : null,
    );
    setDialogOpen(true);
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error("Give the template a name");
      return;
    }
    const payload = {
      kind,
      name: form.name.trim(),
      subject: kind === "email" ? form.subject.trim() || undefined : undefined,
      body: form.body,
      categories: form.categories.trim() || undefined,
      isDefault: form.isDefault,
      isActive: form.isActive,
      imageId: image?.id || "",
    };
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, payload });
        toast.success("Template updated");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Template created");
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  async function remove() {
    if (!confirmDelete) return;
    try {
      await deleteMutation.mutateAsync(confirmDelete.id);
      toast.success("Template deleted");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
    setConfirmDelete(null);
  }

  const countFor = (k: TemplateKind) => meta?.counts.find((c) => c.kind === k)?.count ?? 0;

  return (
    <div className="erp-page" data-testid="templates-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Templates</h1>
          <p className="text-sm text-muted-foreground">
            Reusable descriptions, terms and message bodies
          </p>
        </div>
        <button
          onClick={() => openEditor(null)}
          data-testid="new-template"
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New {TEMPLATE_KIND_LABELS[kind]}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {TEMPLATE_KINDS.map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            data-testid={`template-tab-${k}`}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              kind === k
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border bg-card hover:bg-accent"
            }`}
          >
            {TEMPLATE_KIND_LABELS[k]}
            <span className="ml-1.5 opacity-70">{countFor(k)}</span>
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">{KIND_HELP[kind]}</p>

      {isLoading ? (
        <PageLoader />
      ) : !data?.items.length ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No {TEMPLATE_KIND_LABELS[kind].toLowerCase()} templates yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.items.map((t) => (
            <div
              key={t.id}
              data-testid={`template-card-${t.id}`}
              className="flex flex-col rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {t.isDefault && (
                      <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
                    )}
                    <h2 className="truncate text-sm font-semibold text-foreground">{t.name}</h2>
                  </div>
                  {t.subject && (
                    <p className="truncate text-xs text-muted-foreground">{t.subject}</p>
                  )}
                </div>
                {!t.isActive && (
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    Inactive
                  </span>
                )}
              </div>

              {t.imageUrl && (
                <img
                  src={t.imageUrl}
                  alt=""
                  loading="lazy"
                  className="mb-2 h-24 w-full rounded-lg border border-border object-cover"
                />
              )}

              <p className="mb-3 line-clamp-4 flex-1 whitespace-pre-wrap text-xs text-muted-foreground">
                {t.body || "(empty)"}
              </p>

              {canEdit && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openEditor(t)}
                    className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                  <button
                    onClick={() => setConfirmDelete(t)}
                    className="flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={`${editing ? "Edit" : "New"} ${TEMPLATE_KIND_LABELS[kind]} template`}
        size="lg"
        onSubmit={save}
        isPending={createMutation.isPending || updateMutation.isPending}
        submitLabel={editing ? "Save Changes" : "Create Template"}
      >
        <div className="space-y-4">
          <div>
            <label
              className="mb-1 block text-xs font-medium text-muted-foreground"
              htmlFor="tpl-name"
            >
              Name *
            </label>
            <input
              id="tpl-name"
              className={inputCls}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Standard genset description"
            />
          </div>

          {kind === "email" && (
            <div>
              <label
                className="mb-1 block text-xs font-medium text-muted-foreground"
                htmlFor="tpl-subject"
              >
                Subject
              </label>
              <input
                id="tpl-subject"
                className={inputCls}
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="Quotation {{docNumber}} from {{businessName}}"
              />
            </div>
          )}

          <div>
            <label
              className="mb-1 block text-xs font-medium text-muted-foreground"
              htmlFor="tpl-body"
            >
              {kind === "terms" ? "Conditions (one per line)" : "Body"}
            </label>
            <textarea
              id="tpl-body"
              rows={10}
              className={`${inputCls} leading-relaxed`}
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            />
            {meta?.placeholders?.length ? (
              <div className="mt-1.5 flex flex-wrap gap-1">
                <span className="text-[11px] text-muted-foreground">Insert:</span>
                {meta.placeholders.map((p) => (
                  <button
                    key={p.token}
                    type="button"
                    title={p.label}
                    onClick={() => setForm((f) => ({ ...f, body: `${f.body}{{${p.token}}}` }))}
                    className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:bg-accent"
                  >
                    {`{{${p.token}}}`}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {(kind === "whatsapp" || kind === "description") && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Image</span>
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent"
                >
                  <ImagePlus className="h-3 w-3" /> Choose image
                </button>
              </div>
              {image ? (
                <div className="relative inline-block">
                  <img
                    src={image.thumbnailUrl || image.url}
                    alt=""
                    className="h-24 w-24 rounded-lg border border-border object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setImage(null)}
                    aria-label="Remove image"
                    className="absolute right-0 top-0 rounded-bl bg-black/60 p-0.5 text-white hover:bg-black/80"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No image. WhatsApp templates send the image ahead of the text.
                </p>
              )}
            </div>
          )}

          <div>
            <label
              className="mb-1 block text-xs font-medium text-muted-foreground"
              htmlFor="tpl-categories"
            >
              Categories
            </label>
            <input
              id="tpl-categories"
              className={inputCls}
              value={form.categories}
              onChange={(e) => setForm((f) => ({ ...f, categories: e.target.value }))}
              placeholder="Comma-separated, e.g. Portable Generator"
            />
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={form.isDefault}
                onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
              />
              Offer this one first
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
              Active
            </label>
          </div>
        </div>
      </FormDialog>

      <MediaPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        multiple={false}
        restrictKind="image"
        title="Choose a template image"
        onSelect={(files) => setImage(files[0] ?? null)}
      />

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-foreground">Delete template</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Delete “{confirmDelete.name}”? Documents already created keep their copy of the text.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={remove}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
