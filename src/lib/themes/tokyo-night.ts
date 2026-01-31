import type { Theme } from "@/types/theme";

export const tokyoNightTheme: Theme = {
  id: "tokyo-night",
  name: "Tokyo Night",
  appearance: "dark",
  builtIn: true,
  colors: {
    // Backgrounds (Tokyo Night Storm palette)
    "--color-bg-primary": "#1a1b26",
    "--color-bg-secondary": "#16161e",
    "--color-bg-tertiary": "#1f2335",
    "--color-bg-surface": "#24283b",
    "--color-bg-elevated": "#292e42",
    "--color-bg-hover": "#292e42",
    "--color-bg-active": "#33384d",

    // Text
    "--color-text-primary": "#c0caf5",
    "--color-text-secondary": "#a9b1d6",
    "--color-text-tertiary": "#787c99",
    "--color-text-muted": "#565f89",
    "--color-text-inverse": "#1a1b26",

    // Accent (Tokyo Night purple)
    "--color-accent": "#bb9af7",
    "--color-accent-hover": "#9d7cd8",
    "--color-accent-active": "#7c5dc0",
    "--color-accent-muted": "#3d3560",
    "--color-accent-text": "#1a1b26",

    // Status
    "--color-success": "#9ece6a",
    "--color-success-muted": "#2a3a25",
    "--color-warning": "#e0af68",
    "--color-warning-muted": "#3a3525",
    "--color-error": "#f7768e",
    "--color-error-muted": "#3a2530",
    "--color-info": "#7dcfff",
    "--color-info-muted": "#1a3545",

    // Borders
    "--color-border": "#292e42",
    "--color-border-hover": "#3b4261",
    "--color-border-focus": "#bb9af7",

    // Shadows
    "--shadow-sm": "0 1px 2px 0 rgb(0 0 0 / 0.4)",
    "--shadow-md": "0 4px 6px -1px rgb(0 0 0 / 0.5), 0 2px 4px -2px rgb(0 0 0 / 0.5)",
    "--shadow-lg": "0 10px 15px -3px rgb(0 0 0 / 0.6), 0 4px 6px -4px rgb(0 0 0 / 0.6)",

    // Syntax highlighting (Tokyo Night)
    "--color-syntax-comment": "#565f89",
    "--color-syntax-string": "#9ece6a",
    "--color-syntax-keyword": "#bb9af7",
    "--color-syntax-function": "#7aa2f7",
    "--color-syntax-number": "#ff9e64",
    "--color-syntax-operator": "#89ddff",
    "--color-syntax-variable": "#c0caf5",
    "--color-syntax-punctuation": "#c0caf5",
    "--color-syntax-property": "#73daca",
    "--color-syntax-tag": "#f7768e",
    "--color-syntax-class": "#e0af68",
  },
};

export const tokyoNightDayTheme: Theme = {
  id: "tokyo-night-day",
  name: "Tokyo Night Day",
  appearance: "light",
  builtIn: true,
  colors: {
    // Backgrounds (Tokyo Night Day palette)
    "--color-bg-primary": "#e1e2e7",
    "--color-bg-secondary": "#d5d6db",
    "--color-bg-tertiary": "#c8c9ce",
    "--color-bg-surface": "#ffffff",
    "--color-bg-elevated": "#ffffff",
    "--color-bg-hover": "#d5d6db",
    "--color-bg-active": "#c8c9ce",

    // Text
    "--color-text-primary": "#3760bf",
    "--color-text-secondary": "#4c6bc0",
    "--color-text-tertiary": "#6172b0",
    "--color-text-muted": "#8990b3",
    "--color-text-inverse": "#e1e2e7",

    // Accent (Tokyo Night purple)
    "--color-accent": "#9854f1",
    "--color-accent-hover": "#7847c4",
    "--color-accent-active": "#5d38a0",
    "--color-accent-muted": "#e8dff8",
    "--color-accent-text": "#ffffff",

    // Status
    "--color-success": "#587539",
    "--color-success-muted": "#e0f0d0",
    "--color-warning": "#8c6c3e",
    "--color-warning-muted": "#f5ecd0",
    "--color-error": "#f52a65",
    "--color-error-muted": "#fdd8e0",
    "--color-info": "#007197",
    "--color-info-muted": "#d0f0f8",

    // Borders
    "--color-border": "#c8c9ce",
    "--color-border-hover": "#b8b9be",
    "--color-border-focus": "#9854f1",

    // Shadows
    "--shadow-sm": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    "--shadow-md": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    "--shadow-lg": "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",

    // Syntax highlighting (Tokyo Night Day)
    "--color-syntax-comment": "#8990b3",
    "--color-syntax-string": "#587539",
    "--color-syntax-keyword": "#9854f1",
    "--color-syntax-function": "#2e7de9",
    "--color-syntax-number": "#b15c00",
    "--color-syntax-operator": "#006a83",
    "--color-syntax-variable": "#3760bf",
    "--color-syntax-punctuation": "#3760bf",
    "--color-syntax-property": "#118c74",
    "--color-syntax-tag": "#f52a65",
    "--color-syntax-class": "#8c6c3e",
  },
};
