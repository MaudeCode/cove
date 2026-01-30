import type { Theme } from "@/types/theme";

export const lightTheme: Theme = {
  id: "light",
  name: "Light",
  appearance: "light",
  builtIn: true,
  colors: {
    // Backgrounds
    "--color-bg-primary": "#ffffff",
    "--color-bg-secondary": "#f9fafb",
    "--color-bg-tertiary": "#f3f4f6",
    "--color-bg-surface": "#ffffff",
    "--color-bg-elevated": "#ffffff",
    "--color-bg-hover": "#f3f4f6",
    "--color-bg-active": "#e5e7eb",

    // Text
    "--color-text-primary": "#111827",
    "--color-text-secondary": "#4b5563",
    "--color-text-tertiary": "#6b7280",
    "--color-text-muted": "#9ca3af",
    "--color-text-inverse": "#fafafa",

    // Accent
    "--color-accent": "#2563eb",
    "--color-accent-hover": "#1d4ed8",
    "--color-accent-active": "#1e40af",
    "--color-accent-muted": "#dbeafe",
    "--color-accent-text": "#ffffff",

    // Status
    "--color-success": "#16a34a",
    "--color-success-muted": "#dcfce7",
    "--color-warning": "#ca8a04",
    "--color-warning-muted": "#fef9c3",
    "--color-error": "#dc2626",
    "--color-error-muted": "#fee2e2",
    "--color-info": "#0891b2",
    "--color-info-muted": "#cffafe",

    // Borders
    "--color-border": "#e5e7eb",
    "--color-border-hover": "#d1d5db",
    "--color-border-focus": "#2563eb",

    // Shadows
    "--shadow-sm": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    "--shadow-md": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    "--shadow-lg": "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  },
};
