import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#0b1117",
        panel: "#111923",
        panelAlt: "#0f1720",
        border: "#223044",
        accent: "#3b82f6",
        accentSoft: "#13263f",
        success: "#14b8a6",
        warning: "#f59e0b",
        danger: "#ef4444",
        text: "#e2e8f0",
        muted: "#8ea0b7"
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(59,130,246,0.35), 0 12px 32px rgba(0,0,0,0.24)"
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"]
      },
      backgroundImage: {
        grid: "radial-gradient(circle at center, rgba(148, 163, 184, 0.15) 1px, transparent 1px)"
      }
    }
  },
  plugins: []
};

export default config;
