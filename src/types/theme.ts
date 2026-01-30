/**
 * Theme System Types
 */

/** A theme definition (built-in or custom) */
export interface Theme {
  /** Unique identifier */
  id: string;

  /** Display name */
  name: string;

  /** Light or dark appearance (for system preference matching) */
  appearance: "light" | "dark";

  /** Whether this is a built-in theme */
  builtIn: boolean;

  /** CSS custom property values */
  colors: ThemeColors;
}

/** CSS custom properties for a theme */
export interface ThemeColors {
  // Backgrounds
  "--color-bg-primary": string;
  "--color-bg-secondary": string;
  "--color-bg-tertiary": string;
  "--color-bg-surface": string;
  "--color-bg-elevated": string;
  "--color-bg-hover": string;
  "--color-bg-active": string;

  // Text
  "--color-text-primary": string;
  "--color-text-secondary": string;
  "--color-text-tertiary": string;
  "--color-text-muted": string;
  "--color-text-inverse": string;

  // Accent
  "--color-accent": string;
  "--color-accent-hover": string;
  "--color-accent-active": string;
  "--color-accent-muted": string;
  "--color-accent-text": string;

  // Status
  "--color-success": string;
  "--color-success-muted": string;
  "--color-warning": string;
  "--color-warning-muted": string;
  "--color-error": string;
  "--color-error-muted": string;
  "--color-info": string;
  "--color-info-muted": string;

  // Borders
  "--color-border": string;
  "--color-border-hover": string;
  "--color-border-focus": string;

  // Shadows
  "--shadow-sm": string;
  "--shadow-md": string;
  "--shadow-lg": string;

  // Allow additional custom properties
  [key: `--${string}`]: string;
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
