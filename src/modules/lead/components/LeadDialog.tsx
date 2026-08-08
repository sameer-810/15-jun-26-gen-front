import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormDialog } from "@/modules/common/FormDialog";
import { leadSchema, type LeadFormValues } from "../validations/lead.validation";
import { useCreateLead, useUpdateLead, useAssignableUsers } from "../hooks/useLeads";
import {
  LEAD_STATUSES,
  LEAD_SOURCES,
  FUEL_TYPES,
  LEAD_STATUS_LABELS,
  LEAD_SOURCE_LABELS,
  FUEL_LABELS,
} from "../constants/lead.constants";
import { getApiErrorMessage } from "@/shared/api/http";
import { toast } from "@/shared/lib/toast";
import { useAppSelector } from "@/app/hooks";
import type { Lead } from "../types";

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition";

function Field({
  label,
  error,
  children,
  span2,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  span2?: boolean;
}) {
  return (
    <div className={span2 ? "sm:col-span-2" : undefined}>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  value: Lead | null;
  onSuccess: () => void;
}

export function LeadDialog({ open, onOpenChange, mode, value, onSuccess }: Props) {
  const createMutation = useCreateLead();
  const updateMutation = useUpdateLead();
  const role = useAppSelector((s) => s.auth.user?.role);
  const canAssign = role === "admin" || role === "manager";
  const { data: assignable } = useAssignableUsers(open && canAssign);
  const isPending = createMutation.isPending || updateMutation.isPending;

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      customerName: "",
      mobile: "",
      quantity: 1,
      fuelType: "any",
      source: "walk_in",
      status: "new",
      assignedTo: "",
    },
  });
  const { errors } = form.formState;
  const status = form.watch("status");

  useEffect(() => {
    if (open) {
      form.reset(
        mode === "edit" && value
          ? {
              customerName: value.customerName,
              mobile: value.mobile ?? "",
              alternateMobile: value.alternateMobile ?? "",
              email: value.email ?? "",
              address: value.address ?? "",
              city: value.city ?? "",
              state: value.state ?? "",
              requirement: value.requirement ?? "",
              requiredKva: value.requiredKva,
              quantity: value.quantity ?? 1,
              fuelType: value.fuelType ?? "any",
              estimatedValue: value.estimatedValue ?? 0,
              source: value.source,
              status: value.status,
              assignedTo: value.assignedTo?.id ?? "",
              lostReason: value.lostReason ?? "",
              nextFollowUpDate: value.nextFollowUpDate
                ? value.nextFollowUpDate.substring(0, 10)
                : "",
            }
          : {
              customerName: "",
              mobile: "",
              alternateMobile: "",
              email: "",
              address: "",
              city: "",
              state: "",
              requirement: "",
              requiredKva: undefined,
              quantity: 1,
              fuelType: "any",
              estimatedValue: 0,
              source: "walk_in",
              status: "new",
              assignedTo: "",
              lostReason: "",
              nextFollowUpDate: "",
            },
      );
    }
  }, [open, mode, value, form]);

  async function onSubmit(data: LeadFormValues) {
    try {
      const payload = {
        ...data,
        email: data.email || undefined,
        assignedTo: data.assignedTo || undefined,
        requiredKva: data.requiredKva || undefined,
        nextFollowUpDate: data.nextFollowUpDate || undefined,
      };
      if (mode === "create") {
        await createMutation.mutateAsync(payload);
      } else if (value) {
        await updateMutation.mutateAsync({ id: value.id, payload });
      }
      toast.success(mode === "create" ? "Lead created" : "Lead updated");
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? "New Lead" : "Edit Lead"}
      onSubmit={form.handleSubmit(onSubmit)}
      isPending={isPending}
      size="lg"
      submitLabel={mode === "create" ? "Create Lead" : "Save Changes"}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Customer Name *" error={errors.customerName?.message} span2>
          <input
            className={inputCls}
            placeholder="e.g. Acme Foods Pvt Ltd"
            {...form.register("customerName")}
          />
        </Field>
        <Field label="Mobile" error={errors.mobile?.message}>
          <input className={inputCls} placeholder="9876543210" {...form.register("mobile")} />
        </Field>
        <Field label="Alternate Mobile">
          <input className={inputCls} {...form.register("alternateMobile")} />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <input
            className={inputCls}
            placeholder="contact@company.com"
            {...form.register("email")}
          />
        </Field>
        <Field label="City">
          <input className={inputCls} {...form.register("city")} />
        </Field>
        <Field label="Address" span2>
          <input className={inputCls} {...form.register("address")} />
        </Field>
        <Field label="Requirement" error={errors.requirement?.message} span2>
          <textarea
            className={inputCls}
            rows={2}
            placeholder="Backup genset for cold storage, etc."
            {...form.register("requirement")}
          />
        </Field>
        <Field label="Required KVA" error={errors.requiredKva?.message}>
          <input type="number" step="0.5" className={inputCls} {...form.register("requiredKva")} />
        </Field>
        <Field label="Quantity (units)" error={errors.quantity?.message}>
          <input type="number" min={1} className={inputCls} {...form.register("quantity")} />
        </Field>
        <Field label="Fuel Type">
          <select className={inputCls} {...form.register("fuelType")}>
            {FUEL_TYPES.map((f) => (
              <option key={f} value={f}>
                {FUEL_LABELS[f]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Estimated Value (₹)">
          <input type="number" className={inputCls} {...form.register("estimatedValue")} />
        </Field>
        <Field label="Source">
          <select className={inputCls} {...form.register("source")}>
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>
                {LEAD_SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select className={inputCls} {...form.register("status")}>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Next Follow-up Date">
          <input type="date" className={inputCls} {...form.register("nextFollowUpDate")} />
        </Field>
        {canAssign && (
          <Field label="Assigned To">
            <select className={inputCls} {...form.register("assignedTo")}>
              <option value="">— Unassigned (me) —</option>
              {assignable?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </Field>
        )}
        {status === "not_interested" && (
          <Field label="Reason (not interested)" span2>
            <input className={inputCls} {...form.register("lostReason")} />
          </Field>
        )}
      </div>
    </FormDialog>
  );
}
