import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLogin } from "@/modules/auth/hooks/useAuth";
import { useAppDispatch } from "@/app/hooks";
import { setAuth } from "@/modules/auth/authSlice";
import { LogoFull } from "@/shared/components/Logo";
import { getApiErrorMessage } from "@/shared/api/http";

/**
 * Sign in.
 *
 * Two constraints, both from DESIGN.md ("Login page"):
 *
 * - **No marketing.** Everyone reaching this screen already works here and is
 *   trying to get to a lead. No feature bullets, no stock photography — the
 *   mark, the type and the cobalt carry the identity.
 * - **The submit button is never disabled by validation**, only while a request
 *   is in flight. A disabled control cannot say which rule you failed; this
 *   validates on submit and shows the reason.
 */

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});
type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const loginMutation = useLogin();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
    // Validate when the field is left, not on every keystroke — errors that
    // appear while you are still typing read as the form arguing with you.
    mode: "onBlur",
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      const result = await loginMutation.mutateAsync(values);
      dispatch(setAuth(result));
      navigate("/", { replace: true });
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  }

  const fieldClass =
    "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground " +
    "placeholder-muted-foreground transition-colors focus:border-primary focus:outline-none " +
    "focus:ring-2 focus:ring-ring";

  return (
    <div className="relative min-h-screen bg-sidebar text-sidebar-foreground">
      {/*
        The identity, drawn rather than photographed. A single cobalt field that
        falls away into the sidebar slate — the brand's own two colours, and
        nothing borrowed. DESIGN.md forbids decorative gradients, and this is the
        exception it allows: the ground itself, carrying no content.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(120% 90% at 12% 0%, hsl(var(--primary) / 0.30) 0%, transparent 55%)",
        }}
      />
      {/* Fine engineering rule — a measured grid, not ornament. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            "linear-gradient(to right, hsl(var(--sidebar-border)) 1px, transparent 1px)," +
            "linear-gradient(to bottom, hsl(var(--sidebar-border)) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6 py-14">
        <LogoFull height={92} />

        <h1 className="mt-10 text-2xl font-semibold tracking-tight text-sidebar-foreground">
          Generator Sales &amp; Service
        </h1>
        <p className="mt-1.5 font-mono text-xs uppercase tracking-[0.16em] text-sidebar-foreground/45">
          SRF Power Machine · Internal CRM
        </p>

        <form className="mt-10 space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/15 p-3 text-sm text-destructive-foreground"
            >
              {error}
            </div>
          ) : null}

          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              className={fieldClass}
              placeholder="you@srfpowermachine.com"
              autoComplete="email"
              autoFocus
              aria-invalid={!!form.formState.errors.email}
              {...form.register("email")}
            />
            {form.formState.errors.email && (
              <p className="mt-1.5 text-xs text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className={`${fieldClass} pr-10`}
                autoComplete="current-password"
                aria-invalid={!!form.formState.errors.password}
                {...form.register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground transition-colors hover:text-foreground"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {form.formState.errors.password && (
              <p className="mt-1.5 text-xs text-destructive">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>

          {/*
            Enabled unless a request is actually in flight. Never gated on
            `formState.isValid` — see the note at the top of this file.
          */}
          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground
                       transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loginMutation.isPending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-10 font-mono text-[11px] text-sidebar-foreground/35">
          © {new Date().getFullYear()} SRF Power Machine
        </p>
      </div>
    </div>
  );
}
