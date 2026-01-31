import type { Theme } from "@/types/theme";

export const oneDarkTheme: Theme = {
  id: "one-dark",
  name: "One Dark",
  appearance: "dark",
  builtIn: true,
  colors: {
    // Backgrounds (Atom One Dark palette)
    "--color-bg-primary": "#282c34",
    "--color-bg-secondary": "#21252b",
    "--color-bg-tertiary": "#2c313a",
    "--color-bg-surface": "#3a3f4b",
    "--color-bg-elevated": "#3e4451",
    "--color-bg-hover": "#3a3f4b",
    "--color-bg-active": "#4b5263",

    // Text
    "--color-text-primary": "#abb2bf",
    "--color-text-secondary": "#9da5b4",
    "--color-text-tertiary": "#7f848e",
    "--color-text-muted": "#5c6370",
    "--color-text-inverse": "#282c34",

    // Accent (One Dark cyan)
    "--color-accent": "#61afef",
    "--color-accent-hover": "#528bcc",
    "--color-accent-active": "#4678a8",
    "--color-accent-muted": "#2a3a48",
    "--color-accent-text": "#282c34",

    // Status
    "--color-success": "#98c379",
    "--color-success-muted": "#2a3a28",
    "--color-warning": "#e5c07b",
    "--color-warning-muted": "#3a3828",
    "--color-error": "#e06c75",
    "--color-error-muted": "#3a2828",
    "--color-info": "#56b6c2",
    "--color-info-muted": "#203a3a",

    // Borders
    "--color-border": "#3a3f4b",
    "--color-border-hover": "#4b5263",
    "--color-border-focus": "#61afef",

    // Shadows
    "--shadow-sm": "0 1px 2px 0 rgb(0 0 0 / 0.4)",
    "--shadow-md": "0 4px 6px -1px rgb(0 0 0 / 0.5), 0 2px 4px -2px rgb(0 0 0 / 0.5)",
    "--shadow-lg": "0 10px 15px -3px rgb(0 0 0 / 0.6), 0 4px 6px -4px rgb(0 0 0 / 0.6)",

    // Syntax highlighting (One Dark)
    "--color-syntax-comment": "#5c6370",
    "--color-syntax-string": "#98c379",
    "--color-syntax-keyword": "#c678dd",
    "--color-syntax-function": "#61afef",
    "--color-syntax-number": "#d19a66",
    "--color-syntax-operator": "#56b6c2",
    "--color-syntax-variable": "#e06c75",
    "--color-syntax-punctuation": "#abb2bf",
    "--color-syntax-property": "#e06c75",
    "--color-syntax-tag": "#e06c75",
    "--color-syntax-class": "#e5c07b",
  },
};
