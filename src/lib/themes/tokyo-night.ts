import { defineTheme } from "@/types/theme";

export const tokyoNightTheme = defineTheme({
  id: "tokyo-night",
  name: "Tokyo Night",
  appearance: "dark",
  builtIn: true,
  tokens: {
    // Backgrounds (Tokyo Night Storm palette)
    bgPrimary: "#1a1b26",
    bgSecondary: "#16161e",
    bgTertiary: "#1f2335",
    bgSurface: "#24283b",
    bgElevated: "#292e42",
    bgHover: "#292e42",
    bgActive: "#33384d",

    // Text
    textPrimary: "#c0caf5",
    textSecondary: "#a9b1d6",
    textTertiary: "#787c99",
    textMuted: "#565f89",
    textInverse: "#1a1b26",

    // Accent (Tokyo Night purple)
    accent: "#bb9af7",
    accentHover: "#9d7cd8",
    accentActive: "#7c5dc0",
    accentMuted: "#3d3560",
    accentText: "#1a1b26",

    // Status
    success: "#9ece6a",
    successMuted: "#2a3a25",
    warning: "#e0af68",
    warningMuted: "#3a3525",
    error: "#f7768e",
    errorMuted: "#3a2530",
    info: "#7dcfff",
    infoMuted: "#1a3545",

    // Borders
    border: "#292e42",
    borderHover: "#3b4261",
    borderFocus: "#bb9af7",

    // Shadows
    shadowSm: "0 1px 2px 0 rgb(0 0 0 / 0.4)",
    shadowMd: "0 4px 6px -1px rgb(0 0 0 / 0.5), 0 2px 4px -2px rgb(0 0 0 / 0.5)",
    shadowLg: "0 10px 15px -3px rgb(0 0 0 / 0.6), 0 4px 6px -4px rgb(0 0 0 / 0.6)",

    // Syntax highlighting (Tokyo Night)
    syntaxComment: "#565f89",
    syntaxString: "#9ece6a",
    syntaxKeyword: "#bb9af7",
    syntaxFunction: "#7aa2f7",
    syntaxNumber: "#ff9e64",
    syntaxOperator: "#89ddff",
    syntaxVariable: "#c0caf5",
    syntaxPunctuation: "#c0caf5",
    syntaxProperty: "#73daca",
    syntaxTag: "#f7768e",
    syntaxClass: "#e0af68",
  },
});

export const tokyoNightDayTheme = defineTheme({
  id: "tokyo-night-day",
  name: "Tokyo Night Day",
  appearance: "light",
  builtIn: true,
  tokens: {
    // Backgrounds (Tokyo Night Day palette)
    bgPrimary: "#e1e2e7",
    bgSecondary: "#d5d6db",
    bgTertiary: "#c8c9ce",
    bgSurface: "#ffffff",
    bgElevated: "#ffffff",
    bgHover: "#d5d6db",
    bgActive: "#c8c9ce",

    // Text
    textPrimary: "#3760bf",
    textSecondary: "#4c6bc0",
    textTertiary: "#6172b0",
    textMuted: "#8990b3",
    textInverse: "#e1e2e7",

    // Accent (Tokyo Night purple)
    accent: "#9854f1",
    accentHover: "#7847c4",
    accentActive: "#5d38a0",
    accentMuted: "#e8dff8",
    accentText: "#ffffff",

    // Status
    success: "#587539",
    successMuted: "#e0f0d0",
    warning: "#8c6c3e",
    warningMuted: "#f5ecd0",
    error: "#f52a65",
    errorMuted: "#fdd8e0",
    info: "#007197",
    infoMuted: "#d0f0f8",

    // Borders
    border: "#c8c9ce",
    borderHover: "#b8b9be",
    borderFocus: "#9854f1",

    // Shadows
    shadowSm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    shadowMd: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    shadowLg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",

    // Syntax highlighting (Tokyo Night Day)
    syntaxComment: "#8990b3",
    syntaxString: "#587539",
    syntaxKeyword: "#9854f1",
    syntaxFunction: "#2e7de9",
    syntaxNumber: "#b15c00",
    syntaxOperator: "#006a83",
    syntaxVariable: "#3760bf",
    syntaxPunctuation: "#3760bf",
    syntaxProperty: "#118c74",
    syntaxTag: "#f52a65",
    syntaxClass: "#8c6c3e",
  },
});
