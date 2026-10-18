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
        zinc: {
          50: "#050505",
          100: "#0a0a0a",
          200: "#161616",
          300: "#2f2f2f",
          400: "#525252",
          500: "#6b6b6b",
          600: "#8a8a8a",
          700: "#c9c9c9",
          800: "#e6e6e6",
          900: "#f4f4f4",
          950: "#ffffff",
        },
      },
    },
  },
  plugins: [],
};

export default config;
