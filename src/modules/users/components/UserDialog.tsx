import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormDialog } from "@/modules/common/FormDialog";
import { useCreateUser, useUpdateUser } from "../hooks/useUsers";
import { getApiErrorMessage } from "@/shared/api/http";
import { toast } from "@/shared/lib/toast";
import type { AuthUser } from "@/modules/auth/authSlice";

const ROLES: AuthUser["role"][] = ["admin", "manager", "sales", "inventory"];

const schema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Invalid email"),
  role: z.enum(["admin", "manager", "sales", "inventory"]),
  phone: z.string().trim().optional(),
  password: z.string().optional(),

  // ── Employment record (SRS 3.1) ──────────────────────────────────────────
  joiningDate: z.string().optional(),
  monthlyGross: z.string().optional(),
  incentiveRate: z.string().optional(),
  /**
   * Last four digits only. The full Aadhaar number is not accepted by the API
   * either, so this is not merely a UI convenience — holding the whole number
   * brings DPDP obligations, and identifying an employee needs four digits plus
   * the scan. See DECISIONS.md Q7.
   */
  aadhaarLast4: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Enter the last 4 digits only")
    .optional()
    .or(z.literal("")),
  aadhaarUrl: z
    .string()
    .trim()
    .url("Must be a link to the uploaded file")
    .optional()
    .or(z.literal("")),
  panNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{5}\d{4}[A-Z]$/, "That is not a valid PAN")
    .optional()
    .or(z.literal("")),
  panUrl: z.string().trim().url("Must be a link to the uploaded file").optional().or(z.literal("")),
  utilityBillUrl: z
    .string()
    .trim()
    .url("Must be a link to the uploaded file")
    .optional()
    .or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  name: "",
  email: "",
  role: "sales",
  phone: "",
  password: "",
  joiningDate: "",
  monthlyGross: "",
  incentiveRate: "",
  aadhaarLast4: "",
  aadhaarUrl: "",
  panNumber: "",
  panUrl: "",
  utilityBillUrl: "",
};

/** Blank strings mean "not provided", not "set to zero". */
function num(v?: string) {
  if (v === undefined || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  value: AuthUser | null;
  onSuccess: () => void;
}

export function UserDialog({ open, onOpenChange, mode, value, onSuccess }: Props) {
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const { errors } = form.formState;

  useEffect(() => {
    if (open) {
      form.reset(
        mode === "edit" && value
          ? {
              ...EMPTY,
              name: value.name,
              email: value.email,
              role: value.role,
              phone: value.phone ?? "",
              password: "",
              joiningDate: value.joiningDate ? value.joiningDate.slice(0, 10) : "",
              monthlyGross: value.monthlyGross ? String(value.monthlyGross) : "",
              incentiveRate: value.incentiveRate ? String(value.incentiveRate) : "",
              aadhaarLast4: value.documents?.aadhaarLast4 ?? "",
              aadhaarUrl: value.documents?.aadhaarUrl ?? "",
              panNumber: value.documents?.panNumber ?? "",
              panUrl: value.documents?.panUrl ?? "",
              utilityBillUrl: value.documents?.utilityBillUrl ?? "",
            }
          : EMPTY,
      );
    }
  }, [open, mode, value, form]);

  /** The employment half of the payload, shared by create and update. */
  function employmentPayload(data: FormValues) {
    return {
      joiningDate: data.joiningDate || undefined,
      monthlyGross: num(data.monthlyGross),
      incentiveRate: num(data.incentiveRate),
      documents: {
        aadhaarLast4: data.aadhaarLast4 || "",
        aadhaarUrl: data.aadhaarUrl || "",
        panNumber: data.panNumber || "",
        panUrl: data.panUrl || "",
        utilityBillUrl: data.utilityBillUrl || "",
      },
    };
  }

  async function onSubmit(data: FormValues) {
    try {
      if (mode === "create") {
        if (!data.password || data.password.length < 6) {
          form.setError("password", { message: "Password (min 6 chars) is required" });
          return;
        }
        await createMutation.mutateAsync({
          name: data.name,
          email: data.email,
          role: data.role,
          phone: data.phone,
          password: data.password,
          ...employmentPayload(data),
        });
      } else if (value) {
        await updateMutation.mutateAsync({
          id: value.id,
          payload: {
            name: data.name,
            role: data.role,
            phone: data.phone,
            ...(data.password ? { password: data.password } : {}),
            ...employmentPayload(data),
          },
        });
      }
      toast.success(mode === "create" ? "User created" : "User updated");
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
      title={mode === "create" ? "New User" : "Edit User"}
      onSubmit={form.handleSubmit(onSubmit)}
      isPending={isPending}
      submitLabel={mode === "create" ? "Create User" : "Save Changes"}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Full Name *
          </label>
          <input className={inputCls} {...form.register("name")} />
          {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Email *</label>
          <input className={inputCls} disabled={mode === "edit"} {...form.register("email")} />
          {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Role *</label>
          <select className={inputCls} {...form.register("role")}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Phone</label>
          <input className={inputCls} {...form.register("phone")} />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            {mode === "create" ? "Password *" : "Reset Password"}
          </label>
          <input
            type="password"
            className={inputCls}
            placeholder={mode === "edit" ? "Leave blank to keep" : ""}
            {...form.register("password")}
          />
          {errors.password && (
            <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>

        {/* ── Employment (SRS 3.1) ──────────────────────────────────────── */}
        <div className="sm:col-span-2 border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-foreground">Employment</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Used to calculate attendance-based pay and incentives.
          </p>
        </div>

        <div>
          <label
            className="mb-1 block text-xs font-medium text-muted-foreground"
            htmlFor="user-joining"
          >
            Joining date
          </label>
          <input
            id="user-joining"
            type="date"
            className={inputCls}
            {...form.register("joiningDate")}
          />
        </div>
        <div>
          <label
            className="mb-1 block text-xs font-medium text-muted-foreground"
            htmlFor="user-gross"
          >
            Monthly gross (₹)
          </label>
          <input
            id="user-gross"
            data-testid="user-monthly-gross"
            type="number"
            min={0}
            className={`${inputCls} no-spinner font-mono tabular-nums`}
            {...form.register("monthlyGross")}
          />
        </div>
        <div>
          <label
            className="mb-1 block text-xs font-medium text-muted-foreground"
            htmlFor="user-incentive"
          >
            Incentive rate (% of sales closed)
          </label>
          <input
            id="user-incentive"
            data-testid="user-incentive-rate"
            type="number"
            min={0}
            max={100}
            step="0.1"
            className={`${inputCls} no-spinner font-mono tabular-nums`}
            {...form.register("incentiveRate")}
          />
        </div>
        <div className="flex items-end">
          <p className="text-xs text-muted-foreground">
            Pay is calculated <strong className="font-medium text-foreground">gross</strong>. PF,
            ESI and TDS stay with your accountant.
          </p>
        </div>

        <div className="sm:col-span-2 border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-foreground">Documents</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Upload files under Media, then paste the link here. Visible to admins only.
          </p>
        </div>

        <div>
          <label
            className="mb-1 block text-xs font-medium text-muted-foreground"
            htmlFor="user-aadhaar"
          >
            Aadhaar — last 4 digits only
          </label>
          <input
            id="user-aadhaar"
            data-testid="user-aadhaar-last4"
            inputMode="numeric"
            maxLength={4}
            placeholder="1234"
            className={`${inputCls} font-mono tabular-nums`}
            {...form.register("aadhaarLast4")}
          />
          {errors.aadhaarLast4 ? (
            <p className="mt-1 text-xs text-destructive">{errors.aadhaarLast4.message}</p>
          ) : (
            <p className="mt-1 text-[11px] text-muted-foreground">
              The full number is deliberately never stored.
            </p>
          )}
        </div>
        <div>
          <label
            className="mb-1 block text-xs font-medium text-muted-foreground"
            htmlFor="user-aadhaar-url"
          >
            Aadhaar scan (link)
          </label>
          <input id="user-aadhaar-url" className={inputCls} {...form.register("aadhaarUrl")} />
          {errors.aadhaarUrl && (
            <p className="mt-1 text-xs text-destructive">{errors.aadhaarUrl.message}</p>
          )}
        </div>
        <div>
          <label
            className="mb-1 block text-xs font-medium text-muted-foreground"
            htmlFor="user-pan"
          >
            PAN
          </label>
          <input
            id="user-pan"
            placeholder="ABCDE1234F"
            className={`${inputCls} font-mono uppercase`}
            {...form.register("panNumber")}
          />
          {errors.panNumber && (
            <p className="mt-1 text-xs text-destructive">{errors.panNumber.message}</p>
          )}
        </div>
        <div>
          <label
            className="mb-1 block text-xs font-medium text-muted-foreground"
            htmlFor="user-pan-url"
          >
            PAN card (link)
          </label>
          <input id="user-pan-url" className={inputCls} {...form.register("panUrl")} />
          {errors.panUrl && (
            <p className="mt-1 text-xs text-destructive">{errors.panUrl.message}</p>
          )}
        </div>
        <div className="sm:col-span-2">
          <label
            className="mb-1 block text-xs font-medium text-muted-foreground"
            htmlFor="user-utility"
          >
            Utility bill / address proof (link)
          </label>
          <input id="user-utility" className={inputCls} {...form.register("utilityBillUrl")} />
          {errors.utilityBillUrl && (
            <p className="mt-1 text-xs text-destructive">{errors.utilityBillUrl.message}</p>
          )}
        </div>
      </div>
    </FormDialog>
  );
}
