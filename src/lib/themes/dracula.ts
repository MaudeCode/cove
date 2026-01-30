import type { Theme } from "@/types/theme";

export const draculaTheme: Theme = {
  id: "dracula",
  name: "Dracula",
  appearance: "dark",
  builtIn: true,
  colors: {
    // Backgrounds - more contrast (Dracula palette)
    "--color-bg-primary": "#282a36", // Content area
    "--color-bg-secondary": "#1e1f29", // Chrome/shell (darker)
    "--color-bg-tertiary": "#191a23",
    "--color-bg-surface": "#343746", // Cards, inputs (between primary and comment)
    "--color-bg-elevated": "#44475a",
    "--color-bg-hover": "#3c3f52",
    "--color-bg-active": "#44475a",

    // Text
    "--color-text-primary": "#f8f8f2",
    "--color-text-secondary": "#e6e6e0",
    "--color-text-tertiary": "#bfbfb8",
    "--color-text-muted": "#6272a4",
    "--color-text-inverse": "#282a36",

    // Accent (Dracula purple - more vibrant)
    "--color-accent": "#bd93f9",
    "--color-accent-hover": "#caa9fa",
    "--color-accent-active": "#a67bf5",
    "--color-accent-muted": "#3d3560",
    "--color-accent-text": "#282a36",

    // Status (Dracula colors - vibrant)
    "--color-success": "#50fa7b",
    "--color-success-muted": "#1f3528",
    "--color-warning": "#f1fa8c",
    "--color-warning-muted": "#35351f",
    "--color-error": "#ff5555",
    "--color-error-muted": "#402020",
    "--color-info": "#8be9fd",
    "--color-info-muted": "#1f3538",

    // Borders
    "--color-border": "#44475a",
    "--color-border-hover": "#565970",
    "--color-border-focus": "#bd93f9",

    // Shadows
    "--shadow-sm": "0 1px 2px 0 rgb(0 0 0 / 0.4)",
    "--shadow-md": "0 4px 6px -1px rgb(0 0 0 / 0.5), 0 2px 4px -2px rgb(0 0 0 / 0.5)",
    "--shadow-lg": "0 10px 15px -3px rgb(0 0 0 / 0.6), 0 4px 6px -4px rgb(0 0 0 / 0.6)",
  },
};
