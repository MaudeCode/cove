import { defineTheme } from "@/types/theme";

export const nordTheme = defineTheme({
  id: "nord",
  name: "Nord",
  appearance: "dark",
  builtIn: true,
  tokens: {
    // Backgrounds - more contrast (Polar Night)
    bgPrimary: "#2e3440", // Content area
    bgSecondary: "#242933", // Chrome/shell (darker)
    bgTertiary: "#1f232b",
    bgSurface: "#3b4252", // Cards, inputs
    bgElevated: "#434c5e",
    bgHover: "#3b4252",
    bgActive: "#4c566a",

    // Text (Snow Storm)
    textPrimary: "#eceff4",
    textSecondary: "#e5e9f0",
    textTertiary: "#d8dee9",
    textMuted: "#616e88",
    textInverse: "#2e3440",

    // Accent (Frost - nord8/teal, slightly more vibrant)
    accent: "#8fbcbb",
    accentHover: "#88c0d0",
    accentActive: "#81a1c1",
    accentMuted: "#304048",
    accentText: "#2e3440",

    // Status (Aurora - more vibrant)
    success: "#a3be8c",
    successMuted: "#2e3d2e",
    warning: "#ebcb8b",
    warningMuted: "#3d3828",
    error: "#bf616a",
    errorMuted: "#3d2830",
    info: "#81a1c1",
    infoMuted: "#283040",

    // Borders
    border: "#3b4252",
    borderHover: "#4c566a",
    borderFocus: "#8fbcbb",

    // Shadows
    shadowSm: "0 1px 2px 0 rgb(0 0 0 / 0.3)",
    shadowMd: "0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.4)",
    shadowLg: "0 10px 15px -3px rgb(0 0 0 / 0.5), 0 4px 6px -4px rgb(0 0 0 / 0.5)",

    // Syntax highlighting (Nord palette)
    syntaxComment: "#616e88",
    syntaxString: "#a3be8c",
    syntaxKeyword: "#81a1c1",
    syntaxFunction: "#88c0d0",
    syntaxNumber: "#b48ead",
    syntaxOperator: "#81a1c1",
    syntaxVariable: "#d8dee9",
    syntaxPunctuation: "#eceff4",
    syntaxProperty: "#8fbcbb",
    syntaxTag: "#81a1c1",
    syntaxClass: "#8fbcbb",
  },
});
