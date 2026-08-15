import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, CornerDownLeft, PlusCircle, LogOut, Moon, Sun } from "lucide-react";
import { MENU, filterMenu, type MenuItem } from "./menu";
import { useTheme } from "@/app/theme";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { clearAuth } from "@/modules/auth/authSlice";
import { cn } from "@/lib/utils";

type Cmd = {
  id: string;
  label: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  run: () => void;
};

/** Flatten the role-filtered menu into navigable leaf destinations. */
function flatten(items: MenuItem[], trail: string[] = []): { label: string; to: string }[] {
  const out: { label: string; to: string }[] = [];
  for (const item of items) {
    if (item.children?.length) out.push(...flatten(item.children, [...trail, item.label]));
    else if (item.to) out.push({ label: [...trail, item.label].join(" › "), to: item.to });
  }
  return out;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const role = useAppSelector((s) => s.auth.user?.role);
  const { theme, toggleTheme } = useTheme();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  const commands = useMemo<Cmd[]>(() => {
    const dest = flatten(filterMenu(MENU, role)).map((d) => ({
      id: d.to,
      label: d.label,
      hint: "Go to",
      run: () => navigate(d.to),
    }));
    const actions: Cmd[] = [];
    if (role === "admin" || role === "manager" || role === "sales") {
      actions.push({
        id: "new-lead",
        label: "New Lead",
        hint: "Action",
        icon: PlusCircle,
        run: () => navigate("/leads"),
      });
    }
    actions.push({
      id: "theme",
      label: theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
      hint: "Theme",
      icon: theme === "dark" ? Sun : Moon,
      run: toggleTheme,
    });
    actions.push({
      id: "logout",
      label: "Log out",
      hint: "Account",
      icon: LogOut,
      run: () => {
        dispatch(clearAuth());
        navigate("/login");
      },
    });
    return [...actions, ...dest];
  }, [role, theme, navigate, toggleTheme, dispatch]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(term));
  }, [q, commands]);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
    }
  }, [open]);
  useEffect(() => setActive(0), [q]);

  if (!open) return null;

  function choose(c?: Cmd) {
    if (!c) return;
    onClose();
    c.run();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 pt-[12vh]"
      onClick={onClose}
    >
      <div
        className="pg-overlay w-full max-w-xl animate-overlay-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, filtered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                choose(filtered[active]);
              } else if (e.key === "Escape") onClose();
            }}
            placeholder="Search pages and actions…"
            className="w-full bg-transparent py-3.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No results for "{q}"</p>
          ) : (
            filtered.map((c, i) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.id}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(c)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                    i === active
                      ? "bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-md",
                      i === active
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {Icon ? (
                      <Icon className="h-4 w-4" />
                    ) : (
                      <CornerDownLeft className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <span className="flex-1 font-medium text-foreground">{c.label}</span>
                  {c.hint && <span className="text-xs text-muted-foreground">{c.hint}</span>}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
