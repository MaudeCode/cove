import type { Theme } from "@/types/theme";

export const solarizedDarkTheme: Theme = {
  id: "solarized-dark",
  name: "Solarized Dark",
  appearance: "dark",
  builtIn: true,
  colors: {
    // Backgrounds (Solarized dark palette)
    "--color-bg-primary": "#002b36",
    "--color-bg-secondary": "#00212b",
    "--color-bg-tertiary": "#073642",
    "--color-bg-surface": "#073642",
    "--color-bg-elevated": "#094552",
    "--color-bg-hover": "#094552",
    "--color-bg-active": "#0a5565",

    // Text
    "--color-text-primary": "#839496",
    "--color-text-secondary": "#93a1a1",
    "--color-text-tertiary": "#657b83",
    "--color-text-muted": "#586e75",
    "--color-text-inverse": "#002b36",

    // Accent (Solarized blue)
    "--color-accent": "#268bd2",
    "--color-accent-hover": "#1a7cc4",
    "--color-accent-active": "#1569a8",
    "--color-accent-muted": "#0a3a52",
    "--color-accent-text": "#fdf6e3",

    // Status
    "--color-success": "#859900",
    "--color-success-muted": "#2a3a20",
    "--color-warning": "#b58900",
    "--color-warning-muted": "#3a3520",
    "--color-error": "#dc322f",
    "--color-error-muted": "#3a2020",
    "--color-info": "#2aa198",
    "--color-info-muted": "#1a3a38",

    // Borders
    "--color-border": "#073642",
    "--color-border-hover": "#094552",
    "--color-border-focus": "#268bd2",

    // Shadows
    "--shadow-sm": "0 1px 2px 0 rgb(0 0 0 / 0.4)",
    "--shadow-md": "0 4px 6px -1px rgb(0 0 0 / 0.5), 0 2px 4px -2px rgb(0 0 0 / 0.5)",
    "--shadow-lg": "0 10px 15px -3px rgb(0 0 0 / 0.6), 0 4px 6px -4px rgb(0 0 0 / 0.6)",

    // Syntax highlighting (Solarized)
    "--color-syntax-comment": "#586e75",
    "--color-syntax-string": "#2aa198",
    "--color-syntax-keyword": "#859900",
    "--color-syntax-function": "#268bd2",
    "--color-syntax-number": "#d33682",
    "--color-syntax-operator": "#859900",
    "--color-syntax-variable": "#b58900",
    "--color-syntax-punctuation": "#839496",
    "--color-syntax-property": "#268bd2",
    "--color-syntax-tag": "#cb4b16",
    "--color-syntax-class": "#cb4b16",
  },
};

export const solarizedLightTheme: Theme = {
  id: "solarized-light",
  name: "Solarized Light",
  appearance: "light",
  builtIn: true,
  colors: {
    // Backgrounds (Solarized light palette)
    "--color-bg-primary": "#fdf6e3",
    "--color-bg-secondary": "#eee8d5",
    "--color-bg-tertiary": "#e8e2cf",
    "--color-bg-surface": "#ffffff",
    "--color-bg-elevated": "#ffffff",
    "--color-bg-hover": "#eee8d5",
    "--color-bg-active": "#e0dac8",

    // Text
    "--color-text-primary": "#657b83",
    "--color-text-secondary": "#586e75",
    "--color-text-tertiary": "#839496",
    "--color-text-muted": "#93a1a1",
    "--color-text-inverse": "#fdf6e3",

    // Accent (Solarized blue)
    "--color-accent": "#268bd2",
    "--color-accent-hover": "#1a7cc4",
    "--color-accent-active": "#1569a8",
    "--color-accent-muted": "#d0e8f5",
    "--color-accent-text": "#fdf6e3",

    // Status
    "--color-success": "#859900",
    "--color-success-muted": "#e8f0c8",
    "--color-warning": "#b58900",
    "--color-warning-muted": "#f5ecc8",
    "--color-error": "#dc322f",
    "--color-error-muted": "#f5d0d0",
    "--color-info": "#2aa198",
    "--color-info-muted": "#c8f0ec",

    // Borders
    "--color-border": "#eee8d5",
    "--color-border-hover": "#ddd8c5",
    "--color-border-focus": "#268bd2",

    // Shadows
    "--shadow-sm": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    "--shadow-md": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    "--shadow-lg": "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",

    // Syntax highlighting (Solarized)
    "--color-syntax-comment": "#93a1a1",
    "--color-syntax-string": "#2aa198",
    "--color-syntax-keyword": "#859900",
    "--color-syntax-function": "#268bd2",
    "--color-syntax-number": "#d33682",
    "--color-syntax-operator": "#859900",
    "--color-syntax-variable": "#b58900",
    "--color-syntax-punctuation": "#657b83",
    "--color-syntax-property": "#268bd2",
    "--color-syntax-tag": "#cb4b16",
    "--color-syntax-class": "#cb4b16",
  },
};
