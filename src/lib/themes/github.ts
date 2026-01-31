import type { Theme } from "@/types/theme";

export const githubDarkTheme: Theme = {
  id: "github-dark",
  name: "GitHub Dark",
  appearance: "dark",
  builtIn: true,
  colors: {
    // Backgrounds (GitHub Dark palette)
    "--color-bg-primary": "#0d1117",
    "--color-bg-secondary": "#010409",
    "--color-bg-tertiary": "#161b22",
    "--color-bg-surface": "#21262d",
    "--color-bg-elevated": "#30363d",
    "--color-bg-hover": "#21262d",
    "--color-bg-active": "#30363d",

    // Text
    "--color-text-primary": "#e6edf3",
    "--color-text-secondary": "#c9d1d9",
    "--color-text-tertiary": "#8b949e",
    "--color-text-muted": "#6e7681",
    "--color-text-inverse": "#0d1117",

    // Accent (GitHub blue)
    "--color-accent": "#58a6ff",
    "--color-accent-hover": "#388bfd",
    "--color-accent-active": "#1f6feb",
    "--color-accent-muted": "#1a3050",
    "--color-accent-text": "#ffffff",

    // Status
    "--color-success": "#3fb950",
    "--color-success-muted": "#1a3020",
    "--color-warning": "#d29922",
    "--color-warning-muted": "#3a3020",
    "--color-error": "#f85149",
    "--color-error-muted": "#3a2020",
    "--color-info": "#58a6ff",
    "--color-info-muted": "#1a3050",

    // Borders
    "--color-border": "#30363d",
    "--color-border-hover": "#484f58",
    "--color-border-focus": "#58a6ff",

    // Shadows
    "--shadow-sm": "0 1px 2px 0 rgb(0 0 0 / 0.4)",
    "--shadow-md": "0 4px 6px -1px rgb(0 0 0 / 0.5), 0 2px 4px -2px rgb(0 0 0 / 0.5)",
    "--shadow-lg": "0 10px 15px -3px rgb(0 0 0 / 0.6), 0 4px 6px -4px rgb(0 0 0 / 0.6)",

    // Syntax highlighting (GitHub Dark)
    "--color-syntax-comment": "#8b949e",
    "--color-syntax-string": "#a5d6ff",
    "--color-syntax-keyword": "#ff7b72",
    "--color-syntax-function": "#d2a8ff",
    "--color-syntax-number": "#79c0ff",
    "--color-syntax-operator": "#ff7b72",
    "--color-syntax-variable": "#ffa657",
    "--color-syntax-punctuation": "#c9d1d9",
    "--color-syntax-property": "#7ee787",
    "--color-syntax-tag": "#7ee787",
    "--color-syntax-class": "#ffa657",
  },
};

export const githubLightTheme: Theme = {
  id: "github-light",
  name: "GitHub Light",
  appearance: "light",
  builtIn: true,
  colors: {
    // Backgrounds (GitHub Light palette)
    "--color-bg-primary": "#ffffff",
    "--color-bg-secondary": "#f6f8fa",
    "--color-bg-tertiary": "#eaeef2",
    "--color-bg-surface": "#ffffff",
    "--color-bg-elevated": "#ffffff",
    "--color-bg-hover": "#f3f4f6",
    "--color-bg-active": "#eaeef2",

    // Text
    "--color-text-primary": "#1f2328",
    "--color-text-secondary": "#424a53",
    "--color-text-tertiary": "#656d76",
    "--color-text-muted": "#8c959f",
    "--color-text-inverse": "#ffffff",

    // Accent (GitHub blue)
    "--color-accent": "#0969da",
    "--color-accent-hover": "#0860ca",
    "--color-accent-active": "#0550ae",
    "--color-accent-muted": "#ddf4ff",
    "--color-accent-text": "#ffffff",

    // Status
    "--color-success": "#1a7f37",
    "--color-success-muted": "#dafbe1",
    "--color-warning": "#9a6700",
    "--color-warning-muted": "#fff8c5",
    "--color-error": "#cf222e",
    "--color-error-muted": "#ffebe9",
    "--color-info": "#0969da",
    "--color-info-muted": "#ddf4ff",

    // Borders
    "--color-border": "#d0d7de",
    "--color-border-hover": "#afb8c1",
    "--color-border-focus": "#0969da",

    // Shadows
    "--shadow-sm": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    "--shadow-md": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    "--shadow-lg": "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",

    // Syntax highlighting (GitHub Light)
    "--color-syntax-comment": "#6e7781",
    "--color-syntax-string": "#0a3069",
    "--color-syntax-keyword": "#cf222e",
    "--color-syntax-function": "#8250df",
    "--color-syntax-number": "#0550ae",
    "--color-syntax-operator": "#cf222e",
    "--color-syntax-variable": "#953800",
    "--color-syntax-punctuation": "#1f2328",
    "--color-syntax-property": "#116329",
    "--color-syntax-tag": "#116329",
    "--color-syntax-class": "#953800",
  },
};

export const githubDimmedTheme: Theme = {
  id: "github-dimmed",
  name: "GitHub Dimmed",
  appearance: "dark",
  builtIn: true,
  colors: {
    // Backgrounds (GitHub Dark Dimmed palette)
    "--color-bg-primary": "#22272e",
    "--color-bg-secondary": "#1c2128",
    "--color-bg-tertiary": "#2d333b",
    "--color-bg-surface": "#373e47",
    "--color-bg-elevated": "#444c56",
    "--color-bg-hover": "#2d333b",
    "--color-bg-active": "#373e47",

    // Text
    "--color-text-primary": "#adbac7",
    "--color-text-secondary": "#909dab",
    "--color-text-tertiary": "#768390",
    "--color-text-muted": "#636e7b",
    "--color-text-inverse": "#22272e",

    // Accent (GitHub blue)
    "--color-accent": "#539bf5",
    "--color-accent-hover": "#4184e4",
    "--color-accent-active": "#316dca",
    "--color-accent-muted": "#1a3050",
    "--color-accent-text": "#ffffff",

    // Status
    "--color-success": "#57ab5a",
    "--color-success-muted": "#1a3020",
    "--color-warning": "#c69026",
    "--color-warning-muted": "#3a3020",
    "--color-error": "#e5534b",
    "--color-error-muted": "#3a2020",
    "--color-info": "#539bf5",
    "--color-info-muted": "#1a3050",

    // Borders
    "--color-border": "#444c56",
    "--color-border-hover": "#545d68",
    "--color-border-focus": "#539bf5",

    // Shadows
    "--shadow-sm": "0 1px 2px 0 rgb(0 0 0 / 0.4)",
    "--shadow-md": "0 4px 6px -1px rgb(0 0 0 / 0.5), 0 2px 4px -2px rgb(0 0 0 / 0.5)",
    "--shadow-lg": "0 10px 15px -3px rgb(0 0 0 / 0.6), 0 4px 6px -4px rgb(0 0 0 / 0.6)",

    // Syntax highlighting (GitHub Dark Dimmed)
    "--color-syntax-comment": "#768390",
    "--color-syntax-string": "#96d0ff",
    "--color-syntax-keyword": "#f47067",
    "--color-syntax-function": "#dcbdfb",
    "--color-syntax-number": "#6cb6ff",
    "--color-syntax-operator": "#f47067",
    "--color-syntax-variable": "#f69d50",
    "--color-syntax-punctuation": "#adbac7",
    "--color-syntax-property": "#8ddb8c",
    "--color-syntax-tag": "#8ddb8c",
    "--color-syntax-class": "#f69d50",
  },
};
