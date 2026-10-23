import type { Config } from "tailwindcss";

// Every value below points at a CSS variable in src/styles/tokens.css (the one token file); nothing is hard-coded here.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--background-rgb) / <alpha-value>)",
        surface: "rgb(var(--surface-rgb) / <alpha-value>)",
        raised: "rgb(var(--raised-rgb) / <alpha-value>)",
        sunken: "rgb(var(--sunken-rgb) / <alpha-value>)",
        foreground: "rgb(var(--foreground-rgb) / <alpha-value>)",
        muted: "rgb(var(--muted-rgb) / <alpha-value>)",
        border: "rgb(var(--border-rgb) / <alpha-value>)",
        primary: "rgb(var(--primary-rgb) / <alpha-value>)",
        "primary-hover": "rgb(var(--primary-hover-rgb) / <alpha-value>)",
        accent: "rgb(var(--accent-rgb) / <alpha-value>)",
        dark: "rgb(var(--dark-rgb) / <alpha-value>)",
        success: "rgb(var(--success-rgb) / <alpha-value>)",
        warning: "rgb(var(--warning-rgb) / <alpha-value>)",
        error: "rgb(var(--error-rgb) / <alpha-value>)",
        secondary: "rgb(var(--text-secondary-rgb) / <alpha-value>)",
        ink: "rgb(var(--text-ink-rgb) / <alpha-value>)",
        "on-primary": "var(--on-primary)",
        "quality-complete": "rgb(var(--quality-complete-rgb) / <alpha-value>)",
        "quality-warn": "rgb(var(--quality-warn-rgb) / <alpha-value>)",
        "quality-bad": "rgb(var(--quality-bad-rgb) / <alpha-value>)",
        "quality-info": "rgb(var(--quality-info-rgb) / <alpha-value>)",
      },
      borderRadius: { control: "var(--radius-control)", panel: "var(--radius-panel)", chip: "var(--radius-chip)", card: "var(--radius-card)" },
      fontSize: {
        "ui-xs": ["var(--text-xs)", { lineHeight: "1.4" }],
        "ui-sm": ["var(--text-sm)", { lineHeight: "1.45" }],
        "ui-base": ["var(--text-ui)", { lineHeight: "1.5" }],
        "ui-body": ["var(--text-body)", { lineHeight: "1.6" }],
        "ui-lead": ["var(--text-lead)", { lineHeight: "1.6" }],
        "ui-title": ["var(--text-title)", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
      },
      spacing: { card: "var(--pad-card)", stack: "var(--gap-stack)", chip: "var(--pad-chip-x)" },
      lineHeight: { reading: "var(--leading-reading)" },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        reading: ["var(--font-reading)"],
      },
      transitionTimingFunction: { out: "cubic-bezier(.16,1,.3,1)" },
    },
  },
  plugins: [],
};
export default config;
