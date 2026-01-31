import type { Theme } from "@/types/theme";

export const lightTheme: Theme = {
  id: "light",
  name: "Light",
  appearance: "light",
  builtIn: true,
  colors: {
    // Backgrounds - more contrast between chrome and content
    "--color-bg-primary": "#ffffff", // Content area (white)
    "--color-bg-secondary": "#f1f5f9", // Chrome/shell (cool gray)
    "--color-bg-tertiary": "#e2e8f0",
    "--color-bg-surface": "#f8fafc", // Cards, inputs (off-white)
    "--color-bg-elevated": "#ffffff",
    "--color-bg-hover": "#f1f5f9",
    "--color-bg-active": "#e2e8f0",

    // Text - slightly warmer
    "--color-text-primary": "#0f172a",
    "--color-text-secondary": "#475569",
    "--color-text-tertiary": "#64748b",
    "--color-text-muted": "#94a3b8",
    "--color-text-inverse": "#f8fafc",

    // Accent - warm coral to match dark theme
    "--color-accent": "#e11d48",
    "--color-accent-hover": "#be123c",
    "--color-accent-active": "#9f1239",
    "--color-accent-muted": "#ffe4e6",
    "--color-accent-text": "#ffffff",

    // Status - vibrant
    "--color-success": "#16a34a",
    "--color-success-muted": "#dcfce7",
    "--color-warning": "#d97706",
    "--color-warning-muted": "#fef3c7",
    "--color-error": "#dc2626",
    "--color-error-muted": "#fee2e2",
    "--color-info": "#0284c7",
    "--color-info-muted": "#e0f2fe",

    // Borders
    "--color-border": "#e2e8f0",
    "--color-border-hover": "#cbd5e1",
    "--color-border-focus": "#e11d48",

    // Shadows - slightly more visible
    "--shadow-sm": "0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.08)",
    "--shadow-md": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    "--shadow-lg": "0 10px 15px -3px rgb(0 0 0 / 0.12), 0 4px 6px -4px rgb(0 0 0 / 0.1)",

    // Syntax highlighting (One Light inspired)
    "--color-syntax-comment": "#a0a1a7",
    "--color-syntax-string": "#50a14f",
    "--color-syntax-keyword": "#a626a4",
    "--color-syntax-function": "#4078f2",
    "--color-syntax-number": "#986801",
    "--color-syntax-operator": "#0184bc",
    "--color-syntax-variable": "#e45649",
    "--color-syntax-punctuation": "#383a42",
    "--color-syntax-property": "#e45649",
    "--color-syntax-tag": "#e45649",
    "--color-syntax-class": "#c18401",
  },
};
