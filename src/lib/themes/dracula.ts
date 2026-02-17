import { defineTheme } from "@/types/theme";

export const draculaTheme = defineTheme({
  id: "dracula",
  name: "Dracula",
  appearance: "dark",
  builtIn: true,
  tokens: {
    // Backgrounds - more contrast (Dracula palette)
    bgPrimary: "#282a36", // Content area
    bgSecondary: "#1e1f29", // Chrome/shell (darker)
    bgTertiary: "#191a23",
    bgSurface: "#343746", // Cards, inputs (between primary and comment)
    bgElevated: "#44475a",
    bgHover: "#3c3f52",
    bgActive: "#44475a",

    // Text
    textPrimary: "#f8f8f2",
    textSecondary: "#e6e6e0",
    textTertiary: "#bfbfb8",
    textMuted: "#6272a4",
    textInverse: "#282a36",

    // Accent (Dracula purple - more vibrant)
    accent: "#bd93f9",
    accentHover: "#caa9fa",
    accentActive: "#a67bf5",
    accentMuted: "#3d3560",
    accentText: "#282a36",

    // Status (Dracula colors - vibrant)
    success: "#50fa7b",
    successMuted: "#1f3528",
    warning: "#f1fa8c",
    warningMuted: "#35351f",
    error: "#ff5555",
    errorMuted: "#402020",
    info: "#8be9fd",
    infoMuted: "#1f3538",

    // Borders
    border: "#44475a",
    borderHover: "#565970",
    borderFocus: "#bd93f9",

    // Shadows
    shadowSm: "0 1px 2px 0 rgb(0 0 0 / 0.4)",
    shadowMd: "0 4px 6px -1px rgb(0 0 0 / 0.5), 0 2px 4px -2px rgb(0 0 0 / 0.5)",
    shadowLg: "0 10px 15px -3px rgb(0 0 0 / 0.6), 0 4px 6px -4px rgb(0 0 0 / 0.6)",

    // Syntax highlighting (Dracula palette)
    syntaxComment: "#6272a4",
    syntaxString: "#f1fa8c",
    syntaxKeyword: "#ff79c6",
    syntaxFunction: "#50fa7b",
    syntaxNumber: "#bd93f9",
    syntaxOperator: "#ff79c6",
    syntaxVariable: "#f8f8f2",
    syntaxPunctuation: "#f8f8f2",
    syntaxProperty: "#66d9ef",
    syntaxTag: "#ff79c6",
    syntaxClass: "#8be9fd",
  },
});
