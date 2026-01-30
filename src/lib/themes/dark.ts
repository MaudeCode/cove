import type { Theme } from "@/types/theme";

export const darkTheme: Theme = {
  id: "dark",
  name: "Dark",
  appearance: "dark",
  builtIn: true,
  colors: {
    // Backgrounds - more contrast between layers
    "--color-bg-primary": "#0f0f12", // Content area (darkest)
    "--color-bg-secondary": "#0a0a0c", // Chrome/shell (even darker for contrast)
    "--color-bg-tertiary": "#161619",
    "--color-bg-surface": "#1a1a1f", // Cards, inputs (lighter than primary)
    "--color-bg-elevated": "#222228",
    "--color-bg-hover": "#2a2a32",
    "--color-bg-active": "#363640",

    // Text
    "--color-text-primary": "#f4f4f5",
    "--color-text-secondary": "#a1a1aa",
    "--color-text-tertiary": "#71717a",
    "--color-text-muted": "#52525b",
    "--color-text-inverse": "#09090b",

    // Accent - vibrant teal/cyan for personality
    "--color-accent": "#14b8a6",
    "--color-accent-hover": "#0d9488",
    "--color-accent-active": "#0f766e",
    "--color-accent-muted": "#134e4a",
    "--color-accent-text": "#ffffff",

    // Status
    "--color-success": "#22c55e",
    "--color-success-muted": "#14532d",
    "--color-warning": "#f59e0b",
    "--color-warning-muted": "#451a03",
    "--color-error": "#f43f5e",
    "--color-error-muted": "#4c0519",
    "--color-info": "#38bdf8",
    "--color-info-muted": "#0c4a6e",

    // Borders - subtle accent tint
    "--color-border": "#252530",
    "--color-border-hover": "#3f3f4a",
    "--color-border-focus": "#14b8a6",

    // Shadows
    "--shadow-sm": "0 1px 2px 0 rgb(0 0 0 / 0.4)",
    "--shadow-md": "0 4px 6px -1px rgb(0 0 0 / 0.5), 0 2px 4px -2px rgb(0 0 0 / 0.5)",
    "--shadow-lg": "0 10px 15px -3px rgb(0 0 0 / 0.6), 0 4px 6px -4px rgb(0 0 0 / 0.6)",
  },
};
