import type { Config } from "tailwindcss";

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
        canvas: "#000000",
        surface: {
          DEFAULT: "#0a0a0c",
          elevated: "#0a0a0c",
          hover: "#141417",
          active: "#1c1c22",
        },
      },
      letterSpacing: {
        tight: "-0.015em",
        tighter: "-0.03em",
      },
      borderRadius: {
        device: "12px",
      },
    },
  },
  plugins: [],
};

export default config;
