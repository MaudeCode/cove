import type { Theme } from "@/types/theme";

export const draculaTheme: Theme = {
  id: "dracula",
  name: "Dracula",
  appearance: "dark",
  builtIn: true,
  colors: {
    // Backgrounds (Dracula palette)
    "--color-bg-primary": "#282a36",
    "--color-bg-secondary": "#21222c",
    "--color-bg-tertiary": "#1e1f29",
    "--color-bg-surface": "#44475a",
    "--color-bg-elevated": "#44475a",
    "--color-bg-hover": "#44475a",
    "--color-bg-active": "#6272a4",

    // Text
    "--color-text-primary": "#f8f8f2",
    "--color-text-secondary": "#f8f8f2",
    "--color-text-tertiary": "#6272a4",
    "--color-text-muted": "#6272a4",
    "--color-text-inverse": "#282a36",

    // Accent (Dracula purple)
    "--color-accent": "#bd93f9",
    "--color-accent-hover": "#caa9fa",
    "--color-accent-active": "#a67bf5",
    "--color-accent-muted": "#44475a",
    "--color-accent-text": "#282a36",

    // Status (Dracula colors)
    "--color-success": "#50fa7b",
    "--color-success-muted": "#2d4a35",
    "--color-warning": "#f1fa8c",
    "--color-warning-muted": "#4a4a2d",
    "--color-error": "#ff5555",
    "--color-error-muted": "#4a2d2d",
    "--color-info": "#8be9fd",
    "--color-info-muted": "#2d4a4a",

    // Borders
    "--color-border": "#44475a",
    "--color-border-hover": "#6272a4",
    "--color-border-focus": "#bd93f9",

    // Shadows
    "--shadow-sm": "0 1px 2px 0 rgb(0 0 0 / 0.3)",
    "--shadow-md": "0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.4)",
    "--shadow-lg": "0 10px 15px -3px rgb(0 0 0 / 0.5), 0 4px 6px -4px rgb(0 0 0 / 0.5)",
  },
};
