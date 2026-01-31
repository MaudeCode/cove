import type { Theme } from "@/types/theme";

export const nordTheme: Theme = {
  id: "nord",
  name: "Nord",
  appearance: "dark",
  builtIn: true,
  colors: {
    // Backgrounds - more contrast (Polar Night)
    "--color-bg-primary": "#2e3440", // Content area
    "--color-bg-secondary": "#242933", // Chrome/shell (darker)
    "--color-bg-tertiary": "#1f232b",
    "--color-bg-surface": "#3b4252", // Cards, inputs
    "--color-bg-elevated": "#434c5e",
    "--color-bg-hover": "#3b4252",
    "--color-bg-active": "#4c566a",

    // Text (Snow Storm)
    "--color-text-primary": "#eceff4",
    "--color-text-secondary": "#e5e9f0",
    "--color-text-tertiary": "#d8dee9",
    "--color-text-muted": "#616e88",
    "--color-text-inverse": "#2e3440",

    // Accent (Frost - nord8/teal, slightly more vibrant)
    "--color-accent": "#8fbcbb",
    "--color-accent-hover": "#88c0d0",
    "--color-accent-active": "#81a1c1",
    "--color-accent-muted": "#304048",
    "--color-accent-text": "#2e3440",

    // Status (Aurora - more vibrant)
    "--color-success": "#a3be8c",
    "--color-success-muted": "#2e3d2e",
    "--color-warning": "#ebcb8b",
    "--color-warning-muted": "#3d3828",
    "--color-error": "#bf616a",
    "--color-error-muted": "#3d2830",
    "--color-info": "#81a1c1",
    "--color-info-muted": "#283040",

    // Borders
    "--color-border": "#3b4252",
    "--color-border-hover": "#4c566a",
    "--color-border-focus": "#8fbcbb",

    // Shadows
    "--shadow-sm": "0 1px 2px 0 rgb(0 0 0 / 0.3)",
    "--shadow-md": "0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.4)",
    "--shadow-lg": "0 10px 15px -3px rgb(0 0 0 / 0.5), 0 4px 6px -4px rgb(0 0 0 / 0.5)",

    // Syntax highlighting (Nord palette)
    "--color-syntax-comment": "#616e88",
    "--color-syntax-string": "#a3be8c",
    "--color-syntax-keyword": "#81a1c1",
    "--color-syntax-function": "#88c0d0",
    "--color-syntax-number": "#b48ead",
    "--color-syntax-operator": "#81a1c1",
    "--color-syntax-variable": "#d8dee9",
    "--color-syntax-punctuation": "#eceff4",
    "--color-syntax-property": "#8fbcbb",
    "--color-syntax-tag": "#81a1c1",
    "--color-syntax-class": "#8fbcbb",
  },
};
