import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Menu, Moon, Sun, Search, ChevronDown, UserCircle2 } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { clearAuth } from "@/modules/auth/authSlice";
import { useTheme } from "@/app/theme";
import { useSidebar } from "./sidebarContext";
import { Breadcrumbs } from "./Breadcrumbs";
import { CommandPalette } from "./CommandPalette";
import { PunchButton } from "@/modules/hr/components/PunchButton";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  manager: "Sales Manager",
  sales: "Sales Executive",
  inventory: "Inventory Manager",
};

export function Topbar() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const { theme, toggleTheme } = useTheme();
  const { toggle: toggleSidebar, open: sidebarOpen } = useSidebar();
  const isDark = theme === "dark";

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  // Global ⌘K / Ctrl+K to open the command palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  function logout() {
    dispatch(clearAuth());
    navigate("/login", { replace: true });
  }

  const initials = (user?.name || "U")
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();

  return (
    <>
      {/*
        Was `pg-glass` — a translucent card background with a 24px backdrop
        blur. Frosted glass is the most-cited hallmark of generated UI, but the
        practical objection is stronger: table rows scrolling underneath a
        blurred bar stay faintly visible as moving smears behind the
        breadcrumbs, and it forces a compositing layer on every scroll frame in
        a product whose main activity is scrolling long tables. Opaque, with a
        hairline to separate it from the content.
      */}
      <header className="sticky top-0 z-10 border-b border-border bg-background">
        <div className="flex h-14 items-center gap-3 px-4">
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            aria-expanded={sidebarOpen}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Menu className="h-4 w-4" />
          </button>

          <Breadcrumbs />

          <div className="flex-1" />

          {/* Attendance (SRS 3.1). In the shell because it is the first and last
              thing anyone touches each day — behind navigation it gets forgotten,
              and a forgotten logout is the one event that costs an admin work. */}
          <PunchButton />

          <button
            onClick={() => setPaletteOpen(true)}
            className="hidden items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent sm:flex"
          >
            <Search className="h-4 w-4" />
            <span>Search…</span>
            <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium">
              {isMac ? "⌘" : "Ctrl"} K
            </kbd>
          </button>
          <button
            onClick={() => setPaletteOpen(true)}
            aria-label="Search"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent sm:hidden"
          >
            <Search className="h-4 w-4" />
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 rounded-lg border border-border py-1 pl-1 pr-2 transition-colors hover:bg-accent"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-xs font-bold text-primary">
                {initials}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block text-sm font-semibold leading-tight text-foreground">
                  {user?.name}
                </span>
                <span className="block text-[11px] leading-tight text-muted-foreground">
                  {user?.role ? (ROLE_LABELS[user.role] ?? user.role) : ""}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  menuOpen && "rotate-180",
                )}
              />
            </button>

            {menuOpen && (
              <div className="pg-overlay absolute right-0 top-12 w-60 animate-overlay-in overflow-hidden">
                <div className="border-b border-border px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">{user?.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <div className="p-1.5">
                  <MenuRow
                    icon={isDark ? Sun : Moon}
                    label={isDark ? "Light mode" : "Dark mode"}
                    onClick={toggleTheme}
                  />
                  <MenuRow
                    icon={UserCircle2}
                    label="Settings"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate("/settings");
                    }}
                  />
                </div>
                <div className="border-t border-border p-1.5">
                  <MenuRow icon={LogOut} label="Log out" danger onClick={logout} />
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}

function MenuRow({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        danger ? "text-destructive hover:bg-destructive/10" : "text-foreground hover:bg-accent",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
