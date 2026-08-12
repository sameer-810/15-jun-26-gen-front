import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Building2, Save, ImagePlus, X } from "lucide-react";
import { MediaPickerDialog } from "@/modules/media/components/MediaPickerDialog";
import type { Media } from "@/modules/media/types";
import { useBusinessProfile, useUpdateBusinessProfile } from "../hooks/useSettings";
import { getApiErrorMessage } from "@/shared/api/http";
import { toast } from "@/shared/lib/toast";
import { PageLoader } from "@/shared/components/PageLoader";

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition";

type FormValues = {
  businessName: string;
  tagline: string;
  gstin: string;
  officeAddress: string;
  serviceCenterAddress: string;
  mobileNumbers: string;
  email: string;
  website: string;
  jurisdiction: string;
  defaultCgstRate: number;
  defaultSgstRate: number;
  defaultIgstRate: number;
  bankName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  closingLines: string;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}

type ArtKey = "letterheadHeaderUrl" | "letterheadFooterUrl" | "signatureUrl";

export function SettingsPage() {
  const { data, isLoading } = useBusinessProfile();
  const [art, setArt] = useState<Record<ArtKey, string>>({
    letterheadHeaderUrl: "",
    letterheadFooterUrl: "",
    signatureUrl: "",
  });
  const [pickerFor, setPickerFor] = useState<ArtKey | null>(null);
  const updateMutation = useUpdateBusinessProfile();
  const form = useForm<FormValues>();

  useEffect(() => {
    if (data) {
      form.reset({
        businessName: data.businessName ?? "",
        tagline: data.tagline ?? "",
        gstin: data.gstin ?? "",
        officeAddress: data.officeAddress ?? "",
        serviceCenterAddress: data.serviceCenterAddress ?? "",
        mobileNumbers: (data.mobileNumbers ?? []).join(", "),
        email: data.email ?? "",
        website: data.website ?? "",
        jurisdiction: data.jurisdiction ?? "",
        defaultCgstRate: data.defaultCgstRate ?? 9,
        defaultSgstRate: data.defaultSgstRate ?? 9,
        defaultIgstRate: data.defaultIgstRate ?? 18,
        bankName: data.bankName ?? "",
        bankAccountNumber: data.bankAccountNumber ?? "",
        bankIfsc: data.bankIfsc ?? "",
        closingLines: (data.closingLines ?? []).join("\n"),
      });
      // Letterhead artwork is picked, not typed, so it lives outside the form.
      setArt({
        letterheadHeaderUrl: data.letterheadHeaderUrl ?? "",
        letterheadFooterUrl: data.letterheadFooterUrl ?? "",
        signatureUrl: data.signatureUrl ?? "",
      });
    }
  }, [data, form]);

  if (isLoading) return <PageLoader />;

  async function onSubmit(values: FormValues) {
    try {
      await updateMutation.mutateAsync({
        ...values,
        defaultCgstRate: Number(values.defaultCgstRate),
        defaultSgstRate: Number(values.defaultSgstRate),
        defaultIgstRate: Number(values.defaultIgstRate),
        mobileNumbers: values.mobileNumbers
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        closingLines: (values.closingLines || "")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        ...art,
      });
      toast.success("Business profile updated");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  return (
    <div className="erp-page max-w-4xl">
      <div className="flex items-center gap-2">
        <Building2 className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Company details used on quotations, proforma invoices, and GST breakup
          </p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Company</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Business Name *">
                <input className={inputCls} {...form.register("businessName")} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Tagline">
                <input className={inputCls} {...form.register("tagline")} />
              </Field>
            </div>
            <Field label="GSTIN">
              <input className={inputCls} {...form.register("gstin")} />
            </Field>
            <Field label="Jurisdiction">
              <input className={inputCls} {...form.register("jurisdiction")} />
            </Field>
            <Field label="Email">
              <input className={inputCls} {...form.register("email")} />
            </Field>
            <Field label="Website">
              <input className={inputCls} {...form.register("website")} />
            </Field>
            <Field label="Mobile Numbers (comma separated)">
              <input className={inputCls} {...form.register("mobileNumbers")} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Office Address">
                <textarea className={inputCls} rows={2} {...form.register("officeAddress")} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Service Center Address">
                <textarea
                  className={inputCls}
                  rows={2}
                  {...form.register("serviceCenterAddress")}
                />
              </Field>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Tax Defaults (%)</h2>
          <div className="grid grid-cols-3 gap-4">
            <Field label="CGST">
              <input
                type="number"
                step="0.01"
                className={inputCls}
                {...form.register("defaultCgstRate")}
              />
            </Field>
            <Field label="SGST">
              <input
                type="number"
                step="0.01"
                className={inputCls}
                {...form.register("defaultSgstRate")}
              />
            </Field>
            <Field label="IGST">
              <input
                type="number"
                step="0.01"
                className={inputCls}
                {...form.register("defaultIgstRate")}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Bank Details (Proforma footer)</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Bank Name">
              <input className={inputCls} {...form.register("bankName")} />
            </Field>
            <Field label="Account Number">
              <input className={inputCls} {...form.register("bankAccountNumber")} />
            </Field>
            <Field label="IFSC">
              <input className={inputCls} {...form.register("bankIfsc")} />
            </Field>
          </div>
        </section>

        {/* Point 6 — the client's own letterhead on generated PDFs. */}
        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Letterhead (PDF header & footer)
            </h2>
            <p className="text-xs text-muted-foreground">
              Used on quotations, proforma invoices and tax invoices. Leave blank to keep the
              typeset header.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {(
              [
                ["letterheadHeaderUrl", "Header artwork", "header"],
                ["letterheadFooterUrl", "Footer artwork", "footer"],
                ["signatureUrl", "Signature / stamp", "signature"],
              ] as const
            ).map(([key, label, testId]) => (
              <Field key={key} label={label}>
                {art[key] ? (
                  <div className="relative inline-block">
                    <img
                      src={art[key]}
                      alt={label}
                      className="h-24 w-full rounded-lg border border-border bg-white object-contain p-1"
                    />
                    <button
                      type="button"
                      onClick={() => setArt((a) => ({ ...a, [key]: "" }))}
                      aria-label={`Remove ${label}`}
                      className="absolute right-0 top-0 rounded-bl bg-black/60 p-0.5 text-white hover:bg-black/80"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPickerFor(key)}
                    data-testid={`pick-${testId}`}
                    className="flex h-24 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-xs text-muted-foreground transition-colors hover:bg-accent"
                  >
                    <ImagePlus className="h-4 w-4" /> Choose image
                  </button>
                )}
              </Field>
            ))}
          </div>
          <Field label="Closing lines (one per line, printed above the footer artwork)">
            <textarea
              rows={3}
              className={inputCls}
              placeholder={"Thanking you,\nSales Team HOD,\nFor SAJID MANSURI"}
              {...form.register("closingLines")}
            />
          </Field>
          <p className="text-[11px] text-muted-foreground">
            Leave the closing lines blank if the footer artwork already carries the sign-off, or it
            prints twice.
          </p>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shadow-sm transition-colors"
          >
            <Save className="h-4 w-4" />
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>

      <MediaPickerDialog
        open={Boolean(pickerFor)}
        onOpenChange={(open) => !open && setPickerFor(null)}
        multiple={false}
        restrictKind="image"
        title="Choose letterhead artwork"
        onSelect={(files: Media[]) => {
          if (pickerFor && files[0]) setArt((a) => ({ ...a, [pickerFor]: files[0].url }));
        }}
      />
    </div>
  );
}
