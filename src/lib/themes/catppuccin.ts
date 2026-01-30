import type { Theme } from "@/types/theme";

export const catppuccinMochaTheme: Theme = {
  id: "catppuccin-mocha",
  name: "Catppuccin Mocha",
  appearance: "dark",
  builtIn: true,
  colors: {
    // Backgrounds (Mocha palette)
    "--color-bg-primary": "#1e1e2e",
    "--color-bg-secondary": "#181825",
    "--color-bg-tertiary": "#11111b",
    "--color-bg-surface": "#313244",
    "--color-bg-elevated": "#45475a",
    "--color-bg-hover": "#313244",
    "--color-bg-active": "#45475a",

    // Text
    "--color-text-primary": "#cdd6f4",
    "--color-text-secondary": "#bac2de",
    "--color-text-tertiary": "#a6adc8",
    "--color-text-muted": "#6c7086",
    "--color-text-inverse": "#1e1e2e",

    // Accent (Mauve)
    "--color-accent": "#cba6f7",
    "--color-accent-hover": "#b4befe",
    "--color-accent-active": "#f5c2e7",
    "--color-accent-muted": "#45475a",
    "--color-accent-text": "#1e1e2e",

    // Status
    "--color-success": "#a6e3a1",
    "--color-success-muted": "#2d4a35",
    "--color-warning": "#f9e2af",
    "--color-warning-muted": "#4a4a2d",
    "--color-error": "#f38ba8",
    "--color-error-muted": "#4a2d3a",
    "--color-info": "#89dceb",
    "--color-info-muted": "#2d4a4a",

    // Borders
    "--color-border": "#45475a",
    "--color-border-hover": "#6c7086",
    "--color-border-focus": "#cba6f7",

    // Shadows
    "--shadow-sm": "0 1px 2px 0 rgb(0 0 0 / 0.3)",
    "--shadow-md": "0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.4)",
    "--shadow-lg": "0 10px 15px -3px rgb(0 0 0 / 0.5), 0 4px 6px -4px rgb(0 0 0 / 0.5)",
  },
};

export const catppuccinLatteTheme: Theme = {
  id: "catppuccin-latte",
  name: "Catppuccin Latte",
  appearance: "light",
  builtIn: true,
  colors: {
    // Backgrounds (Latte palette)
    "--color-bg-primary": "#eff1f5",
    "--color-bg-secondary": "#e6e9ef",
    "--color-bg-tertiary": "#dce0e8",
    "--color-bg-surface": "#ccd0da",
    "--color-bg-elevated": "#bcc0cc",
    "--color-bg-hover": "#ccd0da",
    "--color-bg-active": "#bcc0cc",

    // Text
    "--color-text-primary": "#4c4f69",
    "--color-text-secondary": "#5c5f77",
    "--color-text-tertiary": "#6c6f85",
    "--color-text-muted": "#8c8fa1",
    "--color-text-inverse": "#eff1f5",

    // Accent (Mauve)
    "--color-accent": "#8839ef",
    "--color-accent-hover": "#7287fd",
    "--color-accent-active": "#ea76cb",
    "--color-accent-muted": "#ccd0da",
    "--color-accent-text": "#eff1f5",

    // Status
    "--color-success": "#40a02b",
    "--color-success-muted": "#d5f0d0",
    "--color-warning": "#df8e1d",
    "--color-warning-muted": "#f9e8cc",
    "--color-error": "#d20f39",
    "--color-error-muted": "#f9d0d8",
    "--color-info": "#04a5e5",
    "--color-info-muted": "#cceef9",

    // Borders
    "--color-border": "#ccd0da",
    "--color-border-hover": "#bcc0cc",
    "--color-border-focus": "#8839ef",

    // Shadows
    "--shadow-sm": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    "--shadow-md": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    "--shadow-lg": "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  },
};
