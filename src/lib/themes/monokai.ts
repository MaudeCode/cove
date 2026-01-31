import type { Theme } from "@/types/theme";

export const monokaiTheme: Theme = {
  id: "monokai",
  name: "Monokai",
  appearance: "dark",
  builtIn: true,
  colors: {
    // Backgrounds (Monokai Pro palette)
    "--color-bg-primary": "#272822",
    "--color-bg-secondary": "#1e1f1c",
    "--color-bg-tertiary": "#2d2e27",
    "--color-bg-surface": "#3e3d32",
    "--color-bg-elevated": "#49483e",
    "--color-bg-hover": "#3e3d32",
    "--color-bg-active": "#49483e",

    // Text
    "--color-text-primary": "#f8f8f2",
    "--color-text-secondary": "#e6e6e0",
    "--color-text-tertiary": "#b8b8b0",
    "--color-text-muted": "#75715e",
    "--color-text-inverse": "#272822",

    // Accent (Monokai pink)
    "--color-accent": "#f92672",
    "--color-accent-hover": "#e01f65",
    "--color-accent-active": "#c01a58",
    "--color-accent-muted": "#402030",
    "--color-accent-text": "#ffffff",

    // Status
    "--color-success": "#a6e22e",
    "--color-success-muted": "#2a3a20",
    "--color-warning": "#e6db74",
    "--color-warning-muted": "#3a3a25",
    "--color-error": "#f92672",
    "--color-error-muted": "#402030",
    "--color-info": "#66d9ef",
    "--color-info-muted": "#203540",

    // Borders
    "--color-border": "#49483e",
    "--color-border-hover": "#5a5950",
    "--color-border-focus": "#f92672",

    // Shadows
    "--shadow-sm": "0 1px 2px 0 rgb(0 0 0 / 0.4)",
    "--shadow-md": "0 4px 6px -1px rgb(0 0 0 / 0.5), 0 2px 4px -2px rgb(0 0 0 / 0.5)",
    "--shadow-lg": "0 10px 15px -3px rgb(0 0 0 / 0.6), 0 4px 6px -4px rgb(0 0 0 / 0.6)",

    // Syntax highlighting (Monokai)
    "--color-syntax-comment": "#75715e",
    "--color-syntax-string": "#e6db74",
    "--color-syntax-keyword": "#f92672",
    "--color-syntax-function": "#a6e22e",
    "--color-syntax-number": "#ae81ff",
    "--color-syntax-operator": "#f92672",
    "--color-syntax-variable": "#f8f8f2",
    "--color-syntax-punctuation": "#f8f8f2",
    "--color-syntax-property": "#66d9ef",
    "--color-syntax-tag": "#f92672",
    "--color-syntax-class": "#a6e22e",
  },
};
