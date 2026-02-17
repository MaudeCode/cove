import { defineTheme } from "@/types/theme";

export const monokaiTheme = defineTheme({
  id: "monokai",
  name: "Monokai",
  appearance: "dark",
  builtIn: true,
  tokens: {
    // Backgrounds (Monokai Pro palette)
    bgPrimary: "#272822",
    bgSecondary: "#1e1f1c",
    bgTertiary: "#2d2e27",
    bgSurface: "#3e3d32",
    bgElevated: "#49483e",
    bgHover: "#3e3d32",
    bgActive: "#49483e",

    // Text
    textPrimary: "#f8f8f2",
    textSecondary: "#e6e6e0",
    textTertiary: "#b8b8b0",
    textMuted: "#75715e",
    textInverse: "#272822",

    // Accent (Monokai pink)
    accent: "#f92672",
    accentHover: "#e01f65",
    accentActive: "#c01a58",
    accentMuted: "#402030",
    accentText: "#ffffff",

    // Status
    success: "#a6e22e",
    successMuted: "#2a3a20",
    warning: "#e6db74",
    warningMuted: "#3a3a25",
    error: "#f92672",
    errorMuted: "#402030",
    info: "#66d9ef",
    infoMuted: "#203540",

    // Borders
    border: "#49483e",
    borderHover: "#5a5950",
    borderFocus: "#f92672",

    // Shadows
    shadowSm: "0 1px 2px 0 rgb(0 0 0 / 0.4)",
    shadowMd: "0 4px 6px -1px rgb(0 0 0 / 0.5), 0 2px 4px -2px rgb(0 0 0 / 0.5)",
    shadowLg: "0 10px 15px -3px rgb(0 0 0 / 0.6), 0 4px 6px -4px rgb(0 0 0 / 0.6)",

    // Syntax highlighting (Monokai)
    syntaxComment: "#75715e",
    syntaxString: "#e6db74",
    syntaxKeyword: "#f92672",
    syntaxFunction: "#a6e22e",
    syntaxNumber: "#ae81ff",
    syntaxOperator: "#f92672",
    syntaxVariable: "#f8f8f2",
    syntaxPunctuation: "#f8f8f2",
    syntaxProperty: "#66d9ef",
    syntaxTag: "#f92672",
    syntaxClass: "#a6e22e",
  },
});
