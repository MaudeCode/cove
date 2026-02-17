import { defineTheme } from "@/types/theme";

export const catppuccinMochaTheme = defineTheme({
  id: "catppuccin-mocha",
  name: "Catppuccin Mocha",
  appearance: "dark",
  builtIn: true,
  tokens: {
    // Backgrounds - more contrast (Mocha palette)
    bgPrimary: "#1e1e2e", // Content area (Base)
    bgSecondary: "#11111b", // Chrome/shell (Crust - darker)
    bgTertiary: "#181825", // Mantle
    bgSurface: "#313244", // Surface0
    bgElevated: "#45475a", // Surface1
    bgHover: "#313244",
    bgActive: "#45475a",

    // Text
    textPrimary: "#cdd6f4", // Text
    textSecondary: "#bac2de", // Subtext1
    textTertiary: "#a6adc8", // Subtext0
    textMuted: "#6c7086", // Overlay0
    textInverse: "#1e1e2e",

    // Accent (Pink - more distinctive than mauve)
    accent: "#f5c2e7",
    accentHover: "#f5e0dc",
    accentActive: "#cba6f7",
    accentMuted: "#3d2d40",
    accentText: "#1e1e2e",

    // Status (Catppuccin colors)
    success: "#a6e3a1", // Green
    successMuted: "#243028",
    warning: "#f9e2af", // Yellow
    warningMuted: "#382f20",
    error: "#f38ba8", // Red
    errorMuted: "#3d2430",
    info: "#89dceb", // Sky
    infoMuted: "#203035",

    // Borders
    border: "#45475a",
    borderHover: "#585b70",
    borderFocus: "#f5c2e7",

    // Shadows
    shadowSm: "0 1px 2px 0 rgb(0 0 0 / 0.35)",
    shadowMd: "0 4px 6px -1px rgb(0 0 0 / 0.45), 0 2px 4px -2px rgb(0 0 0 / 0.45)",
    shadowLg: "0 10px 15px -3px rgb(0 0 0 / 0.55), 0 4px 6px -4px rgb(0 0 0 / 0.55)",

    // Syntax highlighting (Catppuccin Mocha)
    syntaxComment: "#6c7086",
    syntaxString: "#a6e3a1",
    syntaxKeyword: "#cba6f7",
    syntaxFunction: "#89b4fa",
    syntaxNumber: "#fab387",
    syntaxOperator: "#89dceb",
    syntaxVariable: "#f38ba8",
    syntaxPunctuation: "#cdd6f4",
    syntaxProperty: "#f5c2e7",
    syntaxTag: "#cba6f7",
    syntaxClass: "#f9e2af",
  },
});

export const catppuccinLatteTheme = defineTheme({
  id: "catppuccin-latte",
  name: "Catppuccin Latte",
  appearance: "light",
  builtIn: true,
  tokens: {
    // Backgrounds - more contrast (Latte palette)
    bgPrimary: "#eff1f5", // Content area (Base)
    bgSecondary: "#dce0e8", // Chrome/shell (Crust - darker for contrast)
    bgTertiary: "#e6e9ef", // Mantle
    bgSurface: "#ffffff", // White for cards/inputs (more contrast)
    bgElevated: "#ffffff",
    bgHover: "#e6e9ef",
    bgActive: "#ccd0da",

    // Text
    textPrimary: "#4c4f69", // Text
    textSecondary: "#5c5f77", // Subtext1
    textTertiary: "#6c6f85", // Subtext0
    textMuted: "#9ca0b0", // Overlay0
    textInverse: "#eff1f5",

    // Accent (Pink - vibrant)
    accent: "#ea76cb",
    accentHover: "#d65db1",
    accentActive: "#8839ef",
    accentMuted: "#f5e0f0",
    accentText: "#ffffff",

    // Status
    success: "#40a02b", // Green
    successMuted: "#d8f0d0",
    warning: "#df8e1d", // Yellow
    warningMuted: "#f9ecd0",
    error: "#d20f39", // Red
    errorMuted: "#f9d5dd",
    info: "#04a5e5", // Sky
    infoMuted: "#d0f0f9",

    // Borders
    border: "#ccd0da", // Surface0
    borderHover: "#bcc0cc", // Surface1
    borderFocus: "#ea76cb",

    // Shadows
    shadowSm: "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
    shadowMd: "0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.08)",
    shadowLg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.08)",

    // Syntax highlighting (Catppuccin Latte)
    syntaxComment: "#9ca0b0",
    syntaxString: "#40a02b",
    syntaxKeyword: "#8839ef",
    syntaxFunction: "#1e66f5",
    syntaxNumber: "#fe640b",
    syntaxOperator: "#04a5e5",
    syntaxVariable: "#d20f39",
    syntaxPunctuation: "#4c4f69",
    syntaxProperty: "#ea76cb",
    syntaxTag: "#8839ef",
    syntaxClass: "#df8e1d",
  },
});
