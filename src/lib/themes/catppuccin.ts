import type { Theme } from "@/types/theme";

export const catppuccinMochaTheme: Theme = {
  id: "catppuccin-mocha",
  name: "Catppuccin Mocha",
  appearance: "dark",
  builtIn: true,
  colors: {
    // Backgrounds - more contrast (Mocha palette)
    "--color-bg-primary": "#1e1e2e", // Content area (Base)
    "--color-bg-secondary": "#11111b", // Chrome/shell (Crust - darker)
    "--color-bg-tertiary": "#181825", // Mantle
    "--color-bg-surface": "#313244", // Surface0
    "--color-bg-elevated": "#45475a", // Surface1
    "--color-bg-hover": "#313244",
    "--color-bg-active": "#45475a",

    // Text
    "--color-text-primary": "#cdd6f4", // Text
    "--color-text-secondary": "#bac2de", // Subtext1
    "--color-text-tertiary": "#a6adc8", // Subtext0
    "--color-text-muted": "#6c7086", // Overlay0
    "--color-text-inverse": "#1e1e2e",

    // Accent (Pink - more distinctive than mauve)
    "--color-accent": "#f5c2e7",
    "--color-accent-hover": "#f5e0dc",
    "--color-accent-active": "#cba6f7",
    "--color-accent-muted": "#3d2d40",
    "--color-accent-text": "#1e1e2e",

    // Status (Catppuccin colors)
    "--color-success": "#a6e3a1", // Green
    "--color-success-muted": "#243028",
    "--color-warning": "#f9e2af", // Yellow
    "--color-warning-muted": "#382f20",
    "--color-error": "#f38ba8", // Red
    "--color-error-muted": "#3d2430",
    "--color-info": "#89dceb", // Sky
    "--color-info-muted": "#203035",

    // Borders
    "--color-border": "#45475a",
    "--color-border-hover": "#585b70",
    "--color-border-focus": "#f5c2e7",

    // Shadows
    "--shadow-sm": "0 1px 2px 0 rgb(0 0 0 / 0.35)",
    "--shadow-md": "0 4px 6px -1px rgb(0 0 0 / 0.45), 0 2px 4px -2px rgb(0 0 0 / 0.45)",
    "--shadow-lg": "0 10px 15px -3px rgb(0 0 0 / 0.55), 0 4px 6px -4px rgb(0 0 0 / 0.55)",

    // Syntax highlighting (Catppuccin Mocha)
    "--color-syntax-comment": "#6c7086",
    "--color-syntax-string": "#a6e3a1",
    "--color-syntax-keyword": "#cba6f7",
    "--color-syntax-function": "#89b4fa",
    "--color-syntax-number": "#fab387",
    "--color-syntax-operator": "#89dceb",
    "--color-syntax-variable": "#f38ba8",
    "--color-syntax-punctuation": "#cdd6f4",
    "--color-syntax-property": "#f5c2e7",
    "--color-syntax-tag": "#cba6f7",
    "--color-syntax-class": "#f9e2af",
  },
};

export const catppuccinLatteTheme: Theme = {
  id: "catppuccin-latte",
  name: "Catppuccin Latte",
  appearance: "light",
  builtIn: true,
  colors: {
    // Backgrounds - more contrast (Latte palette)
    "--color-bg-primary": "#eff1f5", // Content area (Base)
    "--color-bg-secondary": "#dce0e8", // Chrome/shell (Crust - darker for contrast)
    "--color-bg-tertiary": "#e6e9ef", // Mantle
    "--color-bg-surface": "#ffffff", // White for cards/inputs (more contrast)
    "--color-bg-elevated": "#ffffff",
    "--color-bg-hover": "#e6e9ef",
    "--color-bg-active": "#ccd0da",

    // Text
    "--color-text-primary": "#4c4f69", // Text
    "--color-text-secondary": "#5c5f77", // Subtext1
    "--color-text-tertiary": "#6c6f85", // Subtext0
    "--color-text-muted": "#9ca0b0", // Overlay0
    "--color-text-inverse": "#eff1f5",

    // Accent (Pink - vibrant)
    "--color-accent": "#ea76cb",
    "--color-accent-hover": "#d65db1",
    "--color-accent-active": "#8839ef",
    "--color-accent-muted": "#f5e0f0",
    "--color-accent-text": "#ffffff",

    // Status
    "--color-success": "#40a02b", // Green
    "--color-success-muted": "#d8f0d0",
    "--color-warning": "#df8e1d", // Yellow
    "--color-warning-muted": "#f9ecd0",
    "--color-error": "#d20f39", // Red
    "--color-error-muted": "#f9d5dd",
    "--color-info": "#04a5e5", // Sky
    "--color-info-muted": "#d0f0f9",

    // Borders
    "--color-border": "#ccd0da", // Surface0
    "--color-border-hover": "#bcc0cc", // Surface1
    "--color-border-focus": "#ea76cb",

    // Shadows
    "--shadow-sm": "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
    "--shadow-md": "0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.08)",
    "--shadow-lg": "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.08)",

    // Syntax highlighting (Catppuccin Latte)
    "--color-syntax-comment": "#9ca0b0",
    "--color-syntax-string": "#40a02b",
    "--color-syntax-keyword": "#8839ef",
    "--color-syntax-function": "#1e66f5",
    "--color-syntax-number": "#fe640b",
    "--color-syntax-operator": "#04a5e5",
    "--color-syntax-variable": "#d20f39",
    "--color-syntax-punctuation": "#4c4f69",
    "--color-syntax-property": "#ea76cb",
    "--color-syntax-tag": "#8839ef",
    "--color-syntax-class": "#df8e1d",
  },
};
