import type { Theme } from "@/types/theme";

export const nordTheme: Theme = {
  id: "nord",
  name: "Nord",
  appearance: "dark",
  builtIn: true,
  colors: {
    // Backgrounds (Nord palette - Polar Night)
    "--color-bg-primary": "#2e3440",
    "--color-bg-secondary": "#292e39",
    "--color-bg-tertiary": "#242933",
    "--color-bg-surface": "#3b4252",
    "--color-bg-elevated": "#434c5e",
    "--color-bg-hover": "#3b4252",
    "--color-bg-active": "#434c5e",

    // Text (Snow Storm)
    "--color-text-primary": "#eceff4",
    "--color-text-secondary": "#e5e9f0",
    "--color-text-tertiary": "#d8dee9",
    "--color-text-muted": "#4c566a",
    "--color-text-inverse": "#2e3440",

    // Accent (Frost - nord8/teal)
    "--color-accent": "#88c0d0",
    "--color-accent-hover": "#8fbcbb",
    "--color-accent-active": "#81a1c1",
    "--color-accent-muted": "#3b4252",
    "--color-accent-text": "#2e3440",

    // Status (Aurora)
    "--color-success": "#a3be8c",
    "--color-success-muted": "#3b4a3b",
    "--color-warning": "#ebcb8b",
    "--color-warning-muted": "#4a4a3b",
    "--color-error": "#bf616a",
    "--color-error-muted": "#4a3b3b",
    "--color-info": "#5e81ac",
    "--color-info-muted": "#3b4252",

    // Borders
    "--color-border": "#3b4252",
    "--color-border-hover": "#4c566a",
    "--color-border-focus": "#88c0d0",

    // Shadows
    "--shadow-sm": "0 1px 2px 0 rgb(0 0 0 / 0.3)",
    "--shadow-md": "0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.4)",
    "--shadow-lg": "0 10px 15px -3px rgb(0 0 0 / 0.5), 0 4px 6px -4px rgb(0 0 0 / 0.5)",
  },
};
