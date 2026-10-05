import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "bg-app": "var(--bg-app)",
        "bg-panel": "var(--bg-panel)",
        "bg-surface": "var(--bg-surface)",
        "bg-field": "var(--bg-field)",
        "bg-hover": "var(--bg-hover)",
        border: "var(--border)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        accent: "var(--accent)",
        "accent-soft": "var(--accent-soft)",
        "bubble-out": "var(--bubble-out)",
        "bubble-in": "var(--bubble-in)",
        warn: "var(--warn)",
        danger: "var(--danger)",
        info: "var(--info)",
      },
      borderColor: {
        DEFAULT: "var(--border)",
      },
    },
  },
  plugins: [],
};

export default config;
