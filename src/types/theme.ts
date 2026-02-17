/**
 * Theme System Types
 */

export type ThemeAppearance = "light" | "dark";

const TOKEN_TO_CSS_VAR = {
  bgPrimary: "--color-bg-primary",
  bgSecondary: "--color-bg-secondary",
  bgTertiary: "--color-bg-tertiary",
  bgSurface: "--color-bg-surface",
  bgElevated: "--color-bg-elevated",
  bgHover: "--color-bg-hover",
  bgActive: "--color-bg-active",

  textPrimary: "--color-text-primary",
  textSecondary: "--color-text-secondary",
  textTertiary: "--color-text-tertiary",
  textMuted: "--color-text-muted",
  textInverse: "--color-text-inverse",

  accent: "--color-accent",
  accentHover: "--color-accent-hover",
  accentActive: "--color-accent-active",
  accentMuted: "--color-accent-muted",
  accentText: "--color-accent-text",

  success: "--color-success",
  successMuted: "--color-success-muted",
  warning: "--color-warning",
  warningMuted: "--color-warning-muted",
  error: "--color-error",
  errorMuted: "--color-error-muted",
  info: "--color-info",
  infoMuted: "--color-info-muted",

  border: "--color-border",
  borderHover: "--color-border-hover",
  borderFocus: "--color-border-focus",

  shadowSm: "--shadow-sm",
  shadowMd: "--shadow-md",
  shadowLg: "--shadow-lg",

  syntaxComment: "--color-syntax-comment",
  syntaxString: "--color-syntax-string",
  syntaxKeyword: "--color-syntax-keyword",
  syntaxFunction: "--color-syntax-function",
  syntaxNumber: "--color-syntax-number",
  syntaxOperator: "--color-syntax-operator",
  syntaxVariable: "--color-syntax-variable",
  syntaxPunctuation: "--color-syntax-punctuation",
  syntaxProperty: "--color-syntax-property",
  syntaxTag: "--color-syntax-tag",
  syntaxClass: "--color-syntax-class",
} as const;

export type ThemeTokenKey = keyof typeof TOKEN_TO_CSS_VAR;
export type ThemeCssVarName = (typeof TOKEN_TO_CSS_VAR)[ThemeTokenKey];
export type ThemeTokens = Record<ThemeTokenKey, string>;
export type ThemeColors = Record<ThemeCssVarName, string>;

const TOKEN_TO_CSS_VAR_ENTRIES = Object.entries(TOKEN_TO_CSS_VAR) as [
  ThemeTokenKey,
  ThemeCssVarName,
][];
const CSS_VAR_TO_TOKEN = TOKEN_TO_CSS_VAR_ENTRIES.reduce(
  (acc, [token, cssVar]) => {
    acc[cssVar] = token;
    return acc;
  },
  {} as Record<ThemeCssVarName, ThemeTokenKey>,
);

/** Theme authoring shape */
export interface ThemeDefinition {
  /** Unique identifier */
  id: string;

  /** Display name */
  name: string;

  /** Light or dark appearance (for system preference matching) */
  appearance: ThemeAppearance;

  /** Whether this is a built-in theme */
  builtIn: boolean;

  /** Typed, semantic design tokens */
  tokens: ThemeTokens;
}

/** Runtime theme shape (includes compiled CSS variables) */
export interface Theme extends ThemeDefinition {
  colors: ThemeColors;
}

/** Legacy stored theme shape (before typed token migration) */
export interface LegacyTheme {
  id: string;
  name: string;
  appearance: ThemeAppearance;
  builtIn: boolean;
  colors: ThemeColors;
}

/** Convert semantic tokens to CSS variables used by the DOM */
export function themeTokensToColors(tokens: ThemeTokens): ThemeColors {
  const colors = {} as ThemeColors;
  for (const [token, cssVar] of TOKEN_TO_CSS_VAR_ENTRIES) {
    colors[cssVar] = tokens[token];
  }
  return colors;
}

/** Convert CSS variables back to semantic tokens (legacy compatibility) */
export function themeColorsToTokens(colors: ThemeColors): ThemeTokens {
  const tokens = {} as ThemeTokens;
  for (const [cssVar, token] of Object.entries(CSS_VAR_TO_TOKEN) as [
    ThemeCssVarName,
    ThemeTokenKey,
  ][]) {
    tokens[token] = colors[cssVar];
  }
  return tokens;
}

/** Define a theme using typed tokens and compile its CSS variables */
export function defineTheme<const T extends ThemeDefinition>(
  theme: T,
): T & { colors: ThemeColors } {
  return {
    ...theme,
    colors: themeTokensToColors(theme.tokens),
  };
}

/** Normalize both new and legacy theme shapes into runtime Theme objects */
export function normalizeTheme(theme: Theme | LegacyTheme): Theme {
  if ("tokens" in theme) {
    return {
      ...theme,
      colors: themeTokensToColors(theme.tokens),
    };
  }
  return {
    ...theme,
    tokens: themeColorsToTokens(theme.colors),
  };
}

/** User's theme preference */
export interface ThemePreference {
  /**
   * Selected theme:
   * - 'system' = auto-switch based on OS preference
   * - Otherwise, a specific theme ID
   */
  selected: "system" | string;

  /** Theme to use when system prefers light */
  lightTheme: string;

  /** Theme to use when system prefers dark */
  darkTheme: string;
}

/** Default theme preference */
export const DEFAULT_THEME_PREFERENCE: ThemePreference = {
  selected: "system",
  lightTheme: "light",
  darkTheme: "dark",
};
