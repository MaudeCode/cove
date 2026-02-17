import { defineTheme } from "@/types/theme";

export const gruvboxDarkTheme = defineTheme({
  id: "gruvbox-dark",
  name: "Gruvbox Dark",
  appearance: "dark",
  builtIn: true,
  tokens: {
    // Backgrounds (Gruvbox dark palette)
    bgPrimary: "#282828",
    bgSecondary: "#1d2021",
    bgTertiary: "#32302f",
    bgSurface: "#3c3836",
    bgElevated: "#504945",
    bgHover: "#504945",
    bgActive: "#665c54",

    // Text
    textPrimary: "#ebdbb2",
    textSecondary: "#d5c4a1",
    textTertiary: "#bdae93",
    textMuted: "#928374",
    textInverse: "#282828",

    // Accent (Gruvbox orange)
    accent: "#fe8019",
    accentHover: "#d65d0e",
    accentActive: "#af3a03",
    accentMuted: "#4a3526",
    accentText: "#282828",

    // Status
    success: "#b8bb26",
    successMuted: "#3d4220",
    warning: "#fabd2f",
    warningMuted: "#4a4020",
    error: "#fb4934",
    errorMuted: "#4a2520",
    info: "#83a598",
    infoMuted: "#2a3a38",

    // Borders
    border: "#504945",
    borderHover: "#665c54",
    borderFocus: "#fe8019",

    // Shadows
    shadowSm: "0 1px 2px 0 rgb(0 0 0 / 0.4)",
    shadowMd: "0 4px 6px -1px rgb(0 0 0 / 0.5), 0 2px 4px -2px rgb(0 0 0 / 0.5)",
    shadowLg: "0 10px 15px -3px rgb(0 0 0 / 0.6), 0 4px 6px -4px rgb(0 0 0 / 0.6)",

    // Syntax highlighting (Gruvbox)
    syntaxComment: "#928374",
    syntaxString: "#b8bb26",
    syntaxKeyword: "#fb4934",
    syntaxFunction: "#b8bb26",
    syntaxNumber: "#d3869b",
    syntaxOperator: "#fe8019",
    syntaxVariable: "#83a598",
    syntaxPunctuation: "#ebdbb2",
    syntaxProperty: "#8ec07c",
    syntaxTag: "#fb4934",
    syntaxClass: "#fabd2f",
  },
});

export const gruvboxLightTheme = defineTheme({
  id: "gruvbox-light",
  name: "Gruvbox Light",
  appearance: "light",
  builtIn: true,
  tokens: {
    // Backgrounds (Gruvbox light palette)
    bgPrimary: "#fbf1c7",
    bgSecondary: "#f2e5bc",
    bgTertiary: "#ebdbb2",
    bgSurface: "#f9f5d7",
    bgElevated: "#ffffff",
    bgHover: "#ebdbb2",
    bgActive: "#d5c4a1",

    // Text
    textPrimary: "#3c3836",
    textSecondary: "#504945",
    textTertiary: "#665c54",
    textMuted: "#928374",
    textInverse: "#fbf1c7",

    // Accent (Gruvbox orange)
    accent: "#d65d0e",
    accentHover: "#af3a03",
    accentActive: "#8f3000",
    accentMuted: "#f0d8c0",
    accentText: "#fbf1c7",

    // Status
    success: "#79740e",
    successMuted: "#e8ecc8",
    warning: "#b57614",
    warningMuted: "#f5e6c8",
    error: "#9d0006",
    errorMuted: "#f5d0c8",
    info: "#076678",
    infoMuted: "#c8e8f0",

    // Borders
    border: "#d5c4a1",
    borderHover: "#bdae93",
    borderFocus: "#d65d0e",

    // Shadows
    shadowSm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    shadowMd: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    shadowLg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",

    // Syntax highlighting (Gruvbox light)
    syntaxComment: "#928374",
    syntaxString: "#79740e",
    syntaxKeyword: "#9d0006",
    syntaxFunction: "#79740e",
    syntaxNumber: "#8f3f71",
    syntaxOperator: "#af3a03",
    syntaxVariable: "#076678",
    syntaxPunctuation: "#3c3836",
    syntaxProperty: "#427b58",
    syntaxTag: "#9d0006",
    syntaxClass: "#b57614",
  },
});
