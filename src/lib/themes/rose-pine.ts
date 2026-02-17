import { defineTheme } from "@/types/theme";

export const rosePineTheme = defineTheme({
  id: "rose-pine",
  name: "Rosé Pine",
  appearance: "dark",
  builtIn: true,
  tokens: {
    // Backgrounds (Rosé Pine palette)
    bgPrimary: "#191724",
    bgSecondary: "#1f1d2e",
    bgTertiary: "#21202e",
    bgSurface: "#26233a",
    bgElevated: "#2a283e",
    bgHover: "#2a283e",
    bgActive: "#393552",

    // Text
    textPrimary: "#e0def4",
    textSecondary: "#c4a7e7",
    textTertiary: "#908caa",
    textMuted: "#6e6a86",
    textInverse: "#191724",

    // Accent (Rosé Pine rose)
    accent: "#ebbcba",
    accentHover: "#d4a5a5",
    accentActive: "#c09090",
    accentMuted: "#3a3040",
    accentText: "#191724",

    // Status
    success: "#9ccfd8",
    successMuted: "#253540",
    warning: "#f6c177",
    warningMuted: "#3a3528",
    error: "#eb6f92",
    errorMuted: "#3a2535",
    info: "#31748f",
    infoMuted: "#1a2a35",

    // Borders
    border: "#26233a",
    borderHover: "#393552",
    borderFocus: "#ebbcba",

    // Shadows
    shadowSm: "0 1px 2px 0 rgb(0 0 0 / 0.4)",
    shadowMd: "0 4px 6px -1px rgb(0 0 0 / 0.5), 0 2px 4px -2px rgb(0 0 0 / 0.5)",
    shadowLg: "0 10px 15px -3px rgb(0 0 0 / 0.6), 0 4px 6px -4px rgb(0 0 0 / 0.6)",

    // Syntax highlighting (Rosé Pine)
    syntaxComment: "#6e6a86",
    syntaxString: "#f6c177",
    syntaxKeyword: "#31748f",
    syntaxFunction: "#ebbcba",
    syntaxNumber: "#eb6f92",
    syntaxOperator: "#9ccfd8",
    syntaxVariable: "#e0def4",
    syntaxPunctuation: "#908caa",
    syntaxProperty: "#c4a7e7",
    syntaxTag: "#eb6f92",
    syntaxClass: "#9ccfd8",
  },
});

export const rosePineMoonTheme = defineTheme({
  id: "rose-pine-moon",
  name: "Rosé Pine Moon",
  appearance: "dark",
  builtIn: true,
  tokens: {
    // Backgrounds (Rosé Pine Moon - slightly lighter)
    bgPrimary: "#232136",
    bgSecondary: "#2a273f",
    bgTertiary: "#2d2a45",
    bgSurface: "#393552",
    bgElevated: "#3e3a58",
    bgHover: "#3e3a58",
    bgActive: "#44415a",

    // Text
    textPrimary: "#e0def4",
    textSecondary: "#c4a7e7",
    textTertiary: "#908caa",
    textMuted: "#6e6a86",
    textInverse: "#232136",

    // Accent (Rosé Pine rose)
    accent: "#ea9a97",
    accentHover: "#d48580",
    accentActive: "#c07570",
    accentMuted: "#3a3040",
    accentText: "#232136",

    // Status
    success: "#9ccfd8",
    successMuted: "#2a3540",
    warning: "#f6c177",
    warningMuted: "#3a3528",
    error: "#eb6f92",
    errorMuted: "#3a2535",
    info: "#3e8fb0",
    infoMuted: "#1a2a38",

    // Borders
    border: "#393552",
    borderHover: "#44415a",
    borderFocus: "#ea9a97",

    // Shadows
    shadowSm: "0 1px 2px 0 rgb(0 0 0 / 0.4)",
    shadowMd: "0 4px 6px -1px rgb(0 0 0 / 0.5), 0 2px 4px -2px rgb(0 0 0 / 0.5)",
    shadowLg: "0 10px 15px -3px rgb(0 0 0 / 0.6), 0 4px 6px -4px rgb(0 0 0 / 0.6)",

    // Syntax highlighting (Rosé Pine Moon)
    syntaxComment: "#6e6a86",
    syntaxString: "#f6c177",
    syntaxKeyword: "#3e8fb0",
    syntaxFunction: "#ea9a97",
    syntaxNumber: "#eb6f92",
    syntaxOperator: "#9ccfd8",
    syntaxVariable: "#e0def4",
    syntaxPunctuation: "#908caa",
    syntaxProperty: "#c4a7e7",
    syntaxTag: "#eb6f92",
    syntaxClass: "#9ccfd8",
  },
});

export const rosePineDawnTheme = defineTheme({
  id: "rose-pine-dawn",
  name: "Rosé Pine Dawn",
  appearance: "light",
  builtIn: true,
  tokens: {
    // Backgrounds (Rosé Pine Dawn - light variant)
    bgPrimary: "#faf4ed",
    bgSecondary: "#f2e9e1",
    bgTertiary: "#e4dfde",
    bgSurface: "#fffaf3",
    bgElevated: "#ffffff",
    bgHover: "#f2e9e1",
    bgActive: "#e4dfde",

    // Text
    textPrimary: "#575279",
    textSecondary: "#797593",
    textTertiary: "#9893a5",
    textMuted: "#b4b0c3",
    textInverse: "#faf4ed",

    // Accent (Rosé Pine rose)
    accent: "#d7827e",
    accentHover: "#c46865",
    accentActive: "#b05550",
    accentMuted: "#fae8e8",
    accentText: "#faf4ed",

    // Status
    success: "#56949f",
    successMuted: "#e0f0f0",
    warning: "#ea9d34",
    warningMuted: "#faf0d8",
    error: "#b4637a",
    errorMuted: "#f8e0e8",
    info: "#286983",
    infoMuted: "#d8f0f8",

    // Borders
    border: "#e4dfde",
    borderHover: "#d5d0ce",
    borderFocus: "#d7827e",

    // Shadows
    shadowSm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    shadowMd: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    shadowLg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",

    // Syntax highlighting (Rosé Pine Dawn)
    syntaxComment: "#9893a5",
    syntaxString: "#ea9d34",
    syntaxKeyword: "#286983",
    syntaxFunction: "#d7827e",
    syntaxNumber: "#b4637a",
    syntaxOperator: "#56949f",
    syntaxVariable: "#575279",
    syntaxPunctuation: "#797593",
    syntaxProperty: "#907aa9",
    syntaxTag: "#b4637a",
    syntaxClass: "#56949f",
  },
});
