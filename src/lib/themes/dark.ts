import { defineTheme } from "@/types/theme";

export const darkTheme = defineTheme({
  id: "dark",
  name: "Dark",
  appearance: "dark",
  builtIn: true,
  tokens: {
    // Backgrounds - more contrast between layers
    bgPrimary: "#0f0f12", // Content area (darkest)
    bgSecondary: "#0a0a0c", // Chrome/shell (even darker for contrast)
    bgTertiary: "#161619",
    bgSurface: "#1a1a1f", // Cards, inputs (lighter than primary)
    bgElevated: "#222228",
    bgHover: "#2a2a32",
    bgActive: "#363640",

    // Text
    textPrimary: "#f4f4f5",
    textSecondary: "#a1a1aa",
    textTertiary: "#71717a",
    textMuted: "#52525b",
    textInverse: "#09090b",

    // Accent - warm coral/lobster red 🦞
    accent: "#f97066",
    accentHover: "#ef5a50",
    accentActive: "#dc4840",
    accentMuted: "#5c2320",
    accentText: "#ffffff",

    // Status
    success: "#22c55e",
    successMuted: "#14532d",
    warning: "#f59e0b",
    warningMuted: "#451a03",
    error: "#f43f5e",
    errorMuted: "#4c0519",
    info: "#38bdf8",
    infoMuted: "#0c4a6e",

    // Borders
    border: "#252530",
    borderHover: "#3f3f4a",
    borderFocus: "#f97066",

    // Shadows
    shadowSm: "0 1px 2px 0 rgb(0 0 0 / 0.4)",
    shadowMd: "0 4px 6px -1px rgb(0 0 0 / 0.5), 0 2px 4px -2px rgb(0 0 0 / 0.5)",
    shadowLg: "0 10px 15px -3px rgb(0 0 0 / 0.6), 0 4px 6px -4px rgb(0 0 0 / 0.6)",

    // Syntax highlighting (One Dark inspired)
    syntaxComment: "#5c6370",
    syntaxString: "#98c379",
    syntaxKeyword: "#c678dd",
    syntaxFunction: "#61afef",
    syntaxNumber: "#d19a66",
    syntaxOperator: "#56b6c2",
    syntaxVariable: "#e06c75",
    syntaxPunctuation: "#abb2bf",
    syntaxProperty: "#e06c75",
    syntaxTag: "#e06c75",
    syntaxClass: "#e5c07b",
  },
});
