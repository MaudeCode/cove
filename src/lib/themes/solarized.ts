import { defineTheme } from "@/types/theme";

export const solarizedDarkTheme = defineTheme({
  id: "solarized-dark",
  name: "Solarized Dark",
  appearance: "dark",
  builtIn: true,
  tokens: {
    // Backgrounds (Solarized dark palette)
    bgPrimary: "#002b36",
    bgSecondary: "#00212b",
    bgTertiary: "#073642",
    bgSurface: "#073642",
    bgElevated: "#094552",
    bgHover: "#094552",
    bgActive: "#0a5565",

    // Text
    textPrimary: "#839496",
    textSecondary: "#93a1a1",
    textTertiary: "#657b83",
    textMuted: "#586e75",
    textInverse: "#002b36",

    // Accent (Solarized blue)
    accent: "#268bd2",
    accentHover: "#1a7cc4",
    accentActive: "#1569a8",
    accentMuted: "#0a3a52",
    accentText: "#fdf6e3",

    // Status
    success: "#859900",
    successMuted: "#2a3a20",
    warning: "#b58900",
    warningMuted: "#3a3520",
    error: "#dc322f",
    errorMuted: "#3a2020",
    info: "#2aa198",
    infoMuted: "#1a3a38",

    // Borders
    border: "#073642",
    borderHover: "#094552",
    borderFocus: "#268bd2",

    // Shadows
    shadowSm: "0 1px 2px 0 rgb(0 0 0 / 0.4)",
    shadowMd: "0 4px 6px -1px rgb(0 0 0 / 0.5), 0 2px 4px -2px rgb(0 0 0 / 0.5)",
    shadowLg: "0 10px 15px -3px rgb(0 0 0 / 0.6), 0 4px 6px -4px rgb(0 0 0 / 0.6)",

    // Syntax highlighting (Solarized)
    syntaxComment: "#586e75",
    syntaxString: "#2aa198",
    syntaxKeyword: "#859900",
    syntaxFunction: "#268bd2",
    syntaxNumber: "#d33682",
    syntaxOperator: "#859900",
    syntaxVariable: "#b58900",
    syntaxPunctuation: "#839496",
    syntaxProperty: "#268bd2",
    syntaxTag: "#cb4b16",
    syntaxClass: "#cb4b16",
  },
});

export const solarizedLightTheme = defineTheme({
  id: "solarized-light",
  name: "Solarized Light",
  appearance: "light",
  builtIn: true,
  tokens: {
    // Backgrounds (Solarized light palette)
    bgPrimary: "#fdf6e3",
    bgSecondary: "#eee8d5",
    bgTertiary: "#e8e2cf",
    bgSurface: "#ffffff",
    bgElevated: "#ffffff",
    bgHover: "#eee8d5",
    bgActive: "#e0dac8",

    // Text
    textPrimary: "#657b83",
    textSecondary: "#586e75",
    textTertiary: "#839496",
    textMuted: "#93a1a1",
    textInverse: "#fdf6e3",

    // Accent (Solarized blue)
    accent: "#268bd2",
    accentHover: "#1a7cc4",
    accentActive: "#1569a8",
    accentMuted: "#d0e8f5",
    accentText: "#fdf6e3",

    // Status
    success: "#859900",
    successMuted: "#e8f0c8",
    warning: "#b58900",
    warningMuted: "#f5ecc8",
    error: "#dc322f",
    errorMuted: "#f5d0d0",
    info: "#2aa198",
    infoMuted: "#c8f0ec",

    // Borders
    border: "#eee8d5",
    borderHover: "#ddd8c5",
    borderFocus: "#268bd2",

    // Shadows
    shadowSm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    shadowMd: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    shadowLg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",

    // Syntax highlighting (Solarized)
    syntaxComment: "#93a1a1",
    syntaxString: "#2aa198",
    syntaxKeyword: "#859900",
    syntaxFunction: "#268bd2",
    syntaxNumber: "#d33682",
    syntaxOperator: "#859900",
    syntaxVariable: "#b58900",
    syntaxPunctuation: "#657b83",
    syntaxProperty: "#268bd2",
    syntaxTag: "#cb4b16",
    syntaxClass: "#cb4b16",
  },
});
