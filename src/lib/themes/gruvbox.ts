import type { Theme } from "@/types/theme";

export const gruvboxDarkTheme: Theme = {
  id: "gruvbox-dark",
  name: "Gruvbox Dark",
  appearance: "dark",
  builtIn: true,
  colors: {
    // Backgrounds (Gruvbox dark palette)
    "--color-bg-primary": "#282828",
    "--color-bg-secondary": "#1d2021",
    "--color-bg-tertiary": "#32302f",
    "--color-bg-surface": "#3c3836",
    "--color-bg-elevated": "#504945",
    "--color-bg-hover": "#504945",
    "--color-bg-active": "#665c54",

    // Text
    "--color-text-primary": "#ebdbb2",
    "--color-text-secondary": "#d5c4a1",
    "--color-text-tertiary": "#bdae93",
    "--color-text-muted": "#928374",
    "--color-text-inverse": "#282828",

    // Accent (Gruvbox orange)
    "--color-accent": "#fe8019",
    "--color-accent-hover": "#d65d0e",
    "--color-accent-active": "#af3a03",
    "--color-accent-muted": "#4a3526",
    "--color-accent-text": "#282828",

    // Status
    "--color-success": "#b8bb26",
    "--color-success-muted": "#3d4220",
    "--color-warning": "#fabd2f",
    "--color-warning-muted": "#4a4020",
    "--color-error": "#fb4934",
    "--color-error-muted": "#4a2520",
    "--color-info": "#83a598",
    "--color-info-muted": "#2a3a38",

    // Borders
    "--color-border": "#504945",
    "--color-border-hover": "#665c54",
    "--color-border-focus": "#fe8019",

    // Shadows
    "--shadow-sm": "0 1px 2px 0 rgb(0 0 0 / 0.4)",
    "--shadow-md": "0 4px 6px -1px rgb(0 0 0 / 0.5), 0 2px 4px -2px rgb(0 0 0 / 0.5)",
    "--shadow-lg": "0 10px 15px -3px rgb(0 0 0 / 0.6), 0 4px 6px -4px rgb(0 0 0 / 0.6)",

    // Syntax highlighting (Gruvbox)
    "--color-syntax-comment": "#928374",
    "--color-syntax-string": "#b8bb26",
    "--color-syntax-keyword": "#fb4934",
    "--color-syntax-function": "#b8bb26",
    "--color-syntax-number": "#d3869b",
    "--color-syntax-operator": "#fe8019",
    "--color-syntax-variable": "#83a598",
    "--color-syntax-punctuation": "#ebdbb2",
    "--color-syntax-property": "#8ec07c",
    "--color-syntax-tag": "#fb4934",
    "--color-syntax-class": "#fabd2f",
  },
};

export const gruvboxLightTheme: Theme = {
  id: "gruvbox-light",
  name: "Gruvbox Light",
  appearance: "light",
  builtIn: true,
  colors: {
    // Backgrounds (Gruvbox light palette)
    "--color-bg-primary": "#fbf1c7",
    "--color-bg-secondary": "#f2e5bc",
    "--color-bg-tertiary": "#ebdbb2",
    "--color-bg-surface": "#f9f5d7",
    "--color-bg-elevated": "#ffffff",
    "--color-bg-hover": "#ebdbb2",
    "--color-bg-active": "#d5c4a1",

    // Text
    "--color-text-primary": "#3c3836",
    "--color-text-secondary": "#504945",
    "--color-text-tertiary": "#665c54",
    "--color-text-muted": "#928374",
    "--color-text-inverse": "#fbf1c7",

    // Accent (Gruvbox orange)
    "--color-accent": "#d65d0e",
    "--color-accent-hover": "#af3a03",
    "--color-accent-active": "#8f3000",
    "--color-accent-muted": "#f0d8c0",
    "--color-accent-text": "#fbf1c7",

    // Status
    "--color-success": "#79740e",
    "--color-success-muted": "#e8ecc8",
    "--color-warning": "#b57614",
    "--color-warning-muted": "#f5e6c8",
    "--color-error": "#9d0006",
    "--color-error-muted": "#f5d0c8",
    "--color-info": "#076678",
    "--color-info-muted": "#c8e8f0",

    // Borders
    "--color-border": "#d5c4a1",
    "--color-border-hover": "#bdae93",
    "--color-border-focus": "#d65d0e",

    // Shadows
    "--shadow-sm": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    "--shadow-md": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    "--shadow-lg": "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",

    // Syntax highlighting (Gruvbox light)
    "--color-syntax-comment": "#928374",
    "--color-syntax-string": "#79740e",
    "--color-syntax-keyword": "#9d0006",
    "--color-syntax-function": "#79740e",
    "--color-syntax-number": "#8f3f71",
    "--color-syntax-operator": "#af3a03",
    "--color-syntax-variable": "#076678",
    "--color-syntax-punctuation": "#3c3836",
    "--color-syntax-property": "#427b58",
    "--color-syntax-tag": "#9d0006",
    "--color-syntax-class": "#b57614",
  },
};
