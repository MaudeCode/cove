import { defineTheme } from "@/types/theme";

export const oneDarkTheme = defineTheme({
  id: "one-dark",
  name: "One Dark",
  appearance: "dark",
  builtIn: true,
  tokens: {
    // Backgrounds (Atom One Dark palette)
    bgPrimary: "#282c34",
    bgSecondary: "#21252b",
    bgTertiary: "#2c313a",
    bgSurface: "#3a3f4b",
    bgElevated: "#3e4451",
    bgHover: "#3a3f4b",
    bgActive: "#4b5263",

    // Text
    textPrimary: "#abb2bf",
    textSecondary: "#9da5b4",
    textTertiary: "#7f848e",
    textMuted: "#5c6370",
    textInverse: "#282c34",

    // Accent (One Dark cyan)
    accent: "#61afef",
    accentHover: "#528bcc",
    accentActive: "#4678a8",
    accentMuted: "#2a3a48",
    accentText: "#282c34",

    // Status
    success: "#98c379",
    successMuted: "#2a3a28",
    warning: "#e5c07b",
    warningMuted: "#3a3828",
    error: "#e06c75",
    errorMuted: "#3a2828",
    info: "#56b6c2",
    infoMuted: "#203a3a",

    // Borders
    border: "#3a3f4b",
    borderHover: "#4b5263",
    borderFocus: "#61afef",

    // Shadows
    shadowSm: "0 1px 2px 0 rgb(0 0 0 / 0.4)",
    shadowMd: "0 4px 6px -1px rgb(0 0 0 / 0.5), 0 2px 4px -2px rgb(0 0 0 / 0.5)",
    shadowLg: "0 10px 15px -3px rgb(0 0 0 / 0.6), 0 4px 6px -4px rgb(0 0 0 / 0.6)",

    // Syntax highlighting (One Dark)
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
