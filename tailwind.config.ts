import type { Config } from "tailwindcss";

// Colors and radii point at the CSS tokens in src/app/globals.css so the
// extension and the web app share one palette.
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        canvas: "var(--bg-canvas)",
        shell: "var(--bg-primary)",
        card: "var(--bg-card)",
        control: {
          DEFAULT: "var(--bg-control)",
          hover: "var(--bg-control-hover)",
          active: "var(--bg-control-active)",
        },
        menu: "var(--bg-menu)",
        line: {
          subtle: "var(--border-subtle)",
          DEFAULT: "var(--border-medium)",
          hover: "var(--border-hover)",
          focus: "var(--border-focus)",
        },
        ink: {
          DEFAULT: "var(--text-main)",
          secondary: "var(--text-secondary)",
          subtle: "var(--text-subtle)",
        },
        accent: "var(--accent)",
      },
      letterSpacing: {
        tight: "-0.015em",
        tighter: "-0.03em",
      },
      borderRadius: {
        control: "10px",
        inner: "7px",
        card: "14px",
        menu: "12px",
        "menu-item": "8px",
        device: "14px",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
