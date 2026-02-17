import { defineTheme } from "@/types/theme";

export const githubDarkTheme = defineTheme({
  id: "github-dark",
  name: "GitHub Dark",
  appearance: "dark",
  builtIn: true,
  tokens: {
    // Backgrounds (GitHub Dark palette)
    bgPrimary: "#0d1117",
    bgSecondary: "#010409",
    bgTertiary: "#161b22",
    bgSurface: "#21262d",
    bgElevated: "#30363d",
    bgHover: "#21262d",
    bgActive: "#30363d",

    // Text
    textPrimary: "#e6edf3",
    textSecondary: "#c9d1d9",
    textTertiary: "#8b949e",
    textMuted: "#6e7681",
    textInverse: "#0d1117",

    // Accent (GitHub blue)
    accent: "#58a6ff",
    accentHover: "#388bfd",
    accentActive: "#1f6feb",
    accentMuted: "#1a3050",
    accentText: "#ffffff",

    // Status
    success: "#3fb950",
    successMuted: "#1a3020",
    warning: "#d29922",
    warningMuted: "#3a3020",
    error: "#f85149",
    errorMuted: "#3a2020",
    info: "#58a6ff",
    infoMuted: "#1a3050",

    // Borders
    border: "#30363d",
    borderHover: "#484f58",
    borderFocus: "#58a6ff",

    // Shadows
    shadowSm: "0 1px 2px 0 rgb(0 0 0 / 0.4)",
    shadowMd: "0 4px 6px -1px rgb(0 0 0 / 0.5), 0 2px 4px -2px rgb(0 0 0 / 0.5)",
    shadowLg: "0 10px 15px -3px rgb(0 0 0 / 0.6), 0 4px 6px -4px rgb(0 0 0 / 0.6)",

    // Syntax highlighting (GitHub Dark)
    syntaxComment: "#8b949e",
    syntaxString: "#a5d6ff",
    syntaxKeyword: "#ff7b72",
    syntaxFunction: "#d2a8ff",
    syntaxNumber: "#79c0ff",
    syntaxOperator: "#ff7b72",
    syntaxVariable: "#ffa657",
    syntaxPunctuation: "#c9d1d9",
    syntaxProperty: "#7ee787",
    syntaxTag: "#7ee787",
    syntaxClass: "#ffa657",
  },
});

export const githubLightTheme = defineTheme({
  id: "github-light",
  name: "GitHub Light",
  appearance: "light",
  builtIn: true,
  tokens: {
    // Backgrounds (GitHub Light palette)
    bgPrimary: "#ffffff",
    bgSecondary: "#f6f8fa",
    bgTertiary: "#eaeef2",
    bgSurface: "#ffffff",
    bgElevated: "#ffffff",
    bgHover: "#f3f4f6",
    bgActive: "#eaeef2",

    // Text
    textPrimary: "#1f2328",
    textSecondary: "#424a53",
    textTertiary: "#656d76",
    textMuted: "#8c959f",
    textInverse: "#ffffff",

    // Accent (GitHub blue)
    accent: "#0969da",
    accentHover: "#0860ca",
    accentActive: "#0550ae",
    accentMuted: "#ddf4ff",
    accentText: "#ffffff",

    // Status
    success: "#1a7f37",
    successMuted: "#dafbe1",
    warning: "#9a6700",
    warningMuted: "#fff8c5",
    error: "#cf222e",
    errorMuted: "#ffebe9",
    info: "#0969da",
    infoMuted: "#ddf4ff",

    // Borders
    border: "#d0d7de",
    borderHover: "#afb8c1",
    borderFocus: "#0969da",

    // Shadows
    shadowSm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    shadowMd: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    shadowLg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",

    // Syntax highlighting (GitHub Light)
    syntaxComment: "#6e7781",
    syntaxString: "#0a3069",
    syntaxKeyword: "#cf222e",
    syntaxFunction: "#8250df",
    syntaxNumber: "#0550ae",
    syntaxOperator: "#cf222e",
    syntaxVariable: "#953800",
    syntaxPunctuation: "#1f2328",
    syntaxProperty: "#116329",
    syntaxTag: "#116329",
    syntaxClass: "#953800",
  },
});

export const githubDimmedTheme = defineTheme({
  id: "github-dimmed",
  name: "GitHub Dimmed",
  appearance: "dark",
  builtIn: true,
  tokens: {
    // Backgrounds (GitHub Dark Dimmed palette)
    bgPrimary: "#22272e",
    bgSecondary: "#1c2128",
    bgTertiary: "#2d333b",
    bgSurface: "#373e47",
    bgElevated: "#444c56",
    bgHover: "#2d333b",
    bgActive: "#373e47",

    // Text
    textPrimary: "#adbac7",
    textSecondary: "#909dab",
    textTertiary: "#768390",
    textMuted: "#636e7b",
    textInverse: "#22272e",

    // Accent (GitHub blue)
    accent: "#539bf5",
    accentHover: "#4184e4",
    accentActive: "#316dca",
    accentMuted: "#1a3050",
    accentText: "#ffffff",

    // Status
    success: "#57ab5a",
    successMuted: "#1a3020",
    warning: "#c69026",
    warningMuted: "#3a3020",
    error: "#e5534b",
    errorMuted: "#3a2020",
    info: "#539bf5",
    infoMuted: "#1a3050",

    // Borders
    border: "#444c56",
    borderHover: "#545d68",
    borderFocus: "#539bf5",

    // Shadows
    shadowSm: "0 1px 2px 0 rgb(0 0 0 / 0.4)",
    shadowMd: "0 4px 6px -1px rgb(0 0 0 / 0.5), 0 2px 4px -2px rgb(0 0 0 / 0.5)",
    shadowLg: "0 10px 15px -3px rgb(0 0 0 / 0.6), 0 4px 6px -4px rgb(0 0 0 / 0.6)",

    // Syntax highlighting (GitHub Dark Dimmed)
    syntaxComment: "#768390",
    syntaxString: "#96d0ff",
    syntaxKeyword: "#f47067",
    syntaxFunction: "#dcbdfb",
    syntaxNumber: "#6cb6ff",
    syntaxOperator: "#f47067",
    syntaxVariable: "#f69d50",
    syntaxPunctuation: "#adbac7",
    syntaxProperty: "#8ddb8c",
    syntaxTag: "#8ddb8c",
    syntaxClass: "#f69d50",
  },
});
