import { defineTheme } from "@/types/theme";

export const lightTheme = defineTheme({
  id: "light",
  name: "Light",
  appearance: "light",
  builtIn: true,
  tokens: {
    // Backgrounds - more contrast between chrome and content
    bgPrimary: "#ffffff", // Content area (white)
    bgSecondary: "#f1f5f9", // Chrome/shell (cool gray)
    bgTertiary: "#e2e8f0",
    bgSurface: "#f8fafc", // Cards, inputs (off-white)
    bgElevated: "#ffffff",
    bgHover: "#f1f5f9",
    bgActive: "#e2e8f0",

    // Text - slightly warmer
    textPrimary: "#0f172a",
    textSecondary: "#475569",
    textTertiary: "#64748b",
    textMuted: "#94a3b8",
    textInverse: "#f8fafc",

    // Accent - warm coral to match dark theme
    accent: "#e11d48",
    accentHover: "#be123c",
    accentActive: "#9f1239",
    accentMuted: "#ffe4e6",
    accentText: "#ffffff",

    // Status - vibrant
    success: "#16a34a",
    successMuted: "#dcfce7",
    warning: "#d97706",
    warningMuted: "#fef3c7",
    error: "#dc2626",
    errorMuted: "#fee2e2",
    info: "#0284c7",
    infoMuted: "#e0f2fe",

    // Borders
    border: "#e2e8f0",
    borderHover: "#cbd5e1",
    borderFocus: "#e11d48",

    // Shadows - slightly more visible
    shadowSm: "0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.08)",
    shadowMd: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    shadowLg: "0 10px 15px -3px rgb(0 0 0 / 0.12), 0 4px 6px -4px rgb(0 0 0 / 0.1)",

    // Syntax highlighting (One Light inspired)
    syntaxComment: "#a0a1a7",
    syntaxString: "#50a14f",
    syntaxKeyword: "#a626a4",
    syntaxFunction: "#4078f2",
    syntaxNumber: "#986801",
    syntaxOperator: "#0184bc",
    syntaxVariable: "#e45649",
    syntaxPunctuation: "#383a42",
    syntaxProperty: "#e45649",
    syntaxTag: "#e45649",
    syntaxClass: "#c18401",
  },
});
