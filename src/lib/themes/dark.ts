import type { Theme } from "@/types/theme";

export const darkTheme: Theme = {
  id: "dark",
  name: "Dark",
  appearance: "dark",
  builtIn: true,
  colors: {
    // Backgrounds
    "--color-bg-primary": "#0a0a0b",
    "--color-bg-secondary": "#111113",
    "--color-bg-tertiary": "#18181b",
    "--color-bg-surface": "#1f1f23",
    "--color-bg-elevated": "#27272a",
    "--color-bg-hover": "#2d2d31",
    "--color-bg-active": "#3f3f46",

    // Text
    "--color-text-primary": "#fafafa",
    "--color-text-secondary": "#a1a1aa",
    "--color-text-tertiary": "#71717a",
    "--color-text-muted": "#52525b",
    "--color-text-inverse": "#09090b",

    // Accent
    "--color-accent": "#3b82f6",
    "--color-accent-hover": "#2563eb",
    "--color-accent-active": "#1d4ed8",
    "--color-accent-muted": "#1e3a5f",
    "--color-accent-text": "#ffffff",

    // Status
    "--color-success": "#22c55e",
    "--color-success-muted": "#14532d",
    "--color-warning": "#eab308",
    "--color-warning-muted": "#422006",
    "--color-error": "#ef4444",
    "--color-error-muted": "#450a0a",
    "--color-info": "#06b6d4",
    "--color-info-muted": "#083344",

    // Borders
    "--color-border": "#27272a",
    "--color-border-hover": "#3f3f46",
    "--color-border-focus": "#3b82f6",

    // Shadows
    "--shadow-sm": "0 1px 2px 0 rgb(0 0 0 / 0.3)",
    "--shadow-md": "0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.4)",
    "--shadow-lg": "0 10px 15px -3px rgb(0 0 0 / 0.5), 0 4px 6px -4px rgb(0 0 0 / 0.5)",
  },
};
