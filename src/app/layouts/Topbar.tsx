import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LogOut,
  Menu,
  Moon,
  Sun,
  Search,
  ChevronDown,
  UserCircle2,
  ChevronLeft,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { clearAuth } from "@/modules/auth/authSlice";
import { useTheme } from "@/app/theme";
import { useSidebar } from "./sidebarContext";
import { Breadcrumbs } from "./Breadcrumbs";
import { useCurrentPageLabel } from "./pageLabels";
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
  const location = useLocation();
  const user = useAppSelector((s) => s.auth.user);
  const { theme, toggleTheme } = useTheme();
  const { toggle: toggleSidebar, open: sidebarOpen } = useSidebar();
  const isDark = theme === "dark";
  const pageLabel = useCurrentPageLabel();

  /**
   * A detail screen is a level down from its list, so on a phone it gets a back
   * chevron where a top-level screen gets nothing. The bottom bar navigates
   * *between* sections; it cannot express "up", and relying on the OS back
   * gesture alone leaves iOS Safari users — who have no on-screen back button
   * in standalone mode — stranded on a lead detail page.
   */
  const isDetailScreen = location.pathname.split("/").filter(Boolean).length > 1;

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
      <header className="pg-safe-top sticky top-0 z-10 border-b border-border bg-background">
        <div className="flex h-14 items-center gap-2 px-3 md:gap-3 md:px-4">
          {/*
            The sidebar toggle is desktop-only now. On a phone the sidebar it
            opened has been replaced by the bottom tab bar, so the control had
            nothing left to toggle — and it was sitting in the top-left corner,
            the furthest point on the screen from a right thumb, which is the
            reason navigation moved to the bottom edge in the first place.
          */}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            aria-expanded={sidebarOpen}
            className="hidden h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground md:flex"
          >
            <Menu className="h-4 w-4" />
          </button>

          {isDetailScreen && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="Back"
              className="pg-tap -ml-2 flex items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}

          <Breadcrumbs />

          {/* The leaf label alone on mobile — a full crumb trail would eat a
              third of a 390px bar to say what the back chevron already says. */}
          <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-foreground md:hidden">
            {pageLabel}
          </h1>

          <div className="hidden flex-1 md:block" />

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
            className="pg-tap flex items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent sm:hidden"
          >
            <Search className="h-5 w-5" />
          </button>

          {/*
            The account control drops to the disc alone below `sm`. Name and role
            in the bar cost ~140px of a 390px row to repeat what the user already
            knows — they are still in the menu this opens, and in the More sheet.
          */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Account menu"
              aria-expanded={menuOpen}
              className="pg-tap flex items-center gap-2 rounded-lg transition-colors hover:bg-accent sm:border sm:border-border sm:py-1 sm:pl-1 sm:pr-2"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-xs font-bold text-primary sm:h-7 sm:w-7">
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
                  "hidden h-4 w-4 text-muted-foreground transition-transform sm:block",
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
