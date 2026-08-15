/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        /**
         * `--popover` / `--popover-foreground` were defined in index.css for
         * both themes but never mapped here, so `bg-popover` silently did not
         * exist and every menu, dialog and dropdown fell back to `bg-card`.
         * They are the same value in light mode, which is why nobody noticed.
         * Mapped now so overlays have their own surface token to diverge on.
         */
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      /**
       * Humanist sans for the interface, monospace for data. See DESIGN.md.
       *
       * `mono` was never declared before, so the 15 existing `font-mono` usages
       * fell through to Tailwind's default stack — Consolas on Windows, Menlo on
       * macOS, something else on Linux. Quotation totals and kVA ratings
       * rendered differently on every machine in the office.
       *
       * IBM Plex was built for enterprise software and the mono is a designed
       * companion to the sans, so figures and labels sit on the same skeleton.
       */
      fontFamily: {
        sans: ["IBM Plex Sans", "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      /**
       * Overlays only.
       *
       * The old `fade-in` (opacity + 4px rise, 200ms) was applied to whole page
       * bodies on mount. On a tool someone opens forty times a day that is
       * 200ms of nothing before the first number is readable, and it is the
       * most common tell in generated interfaces. It is replaced by a shorter,
       * opacity-only fade used exclusively where something genuinely appears
       * over the page — menus, the command palette.
       */
      keyframes: {
        "overlay-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "overlay-in": "overlay-in 120ms ease-out",
      },
    },
  },
  plugins: [],
};
