/**
 * Theme System
 *
 * Manages theme state and applies CSS variables to DOM.
 * Works with the inline script in index.html to prevent FOUC.
 */

import { signal, effect, computed } from "@preact/signals";
import type { Theme, ThemePreference, ThemeColors } from "@/types/theme";
import { DEFAULT_THEME_PREFERENCE } from "@/types/theme";
import { getTheme, builtInThemes } from "@/lib/themes";
import {
  getThemePreference,
  setThemePreference as saveThemePreference,
  getCustomThemes,
  setThemeCache,
} from "./storage";

/** Current theme preference */
export const themePreference = signal<ThemePreference>(loadPreference());

/** Custom themes (user-created) */
const customThemes = signal<Theme[]>(getCustomThemes());

/** The currently active theme (resolved) */
const activeTheme = computed<Theme>(() => {
  const pref = themePreference.value;
  const customs = customThemes.value;

  if (pref.selected === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const themeId = prefersDark ? pref.darkTheme : pref.lightTheme;
    return getTheme(themeId, customs) ?? getTheme("dark", customs)!;
  }

  return getTheme(pref.selected, customs) ?? getTheme("dark", customs)!;
});

/**
 * Load preference from storage
 */
function loadPreference(): ThemePreference {
  const stored = getThemePreference<ThemePreference>();
  if (stored) {
    return { ...DEFAULT_THEME_PREFERENCE, ...stored };
  }
  return DEFAULT_THEME_PREFERENCE;
}

/**
 * Apply a theme's CSS variables to the document
 */
function applyThemeColors(colors: ThemeColors): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(colors)) {
    root.style.setProperty(key, value);
  }
}

/**
 * Cache the theme for the inline script (prevents FOUC on reload)
 */
function cacheTheme(theme: Theme): void {
  setThemeCache(
    theme.id,
    JSON.stringify({
      id: theme.id,
      appearance: theme.appearance,
      colors: theme.colors,
    }),
  );
}

/**
 * Apply the current theme to the document
 */
function applyTheme(theme: Theme): void {
  applyThemeColors(theme.colors);

  // Cache for inline script to use on next load
  cacheTheme(theme);

  // Update meta theme-color for mobile browsers
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute(
      "content",
      theme.colors["--color-bg-primary"] ?? (theme.appearance === "dark" ? "#0a0a0b" : "#ffffff"),
    );
  }

  // Set data-appearance for CSS selectors that need to know light/dark
  document.documentElement.setAttribute("data-appearance", theme.appearance);
}

/**
 * Set the theme preference
 */
export function setTheme(selected: "system" | string): void {
  themePreference.value = { ...themePreference.value, selected };
}

/**
 * Set the light theme for system preference
 */
export function setLightTheme(themeId: string): void {
  themePreference.value = { ...themePreference.value, lightTheme: themeId };
}

/**
 * Set the dark theme for system preference
 */
export function setDarkTheme(themeId: string): void {
  themePreference.value = { ...themePreference.value, darkTheme: themeId };
}

/**
 * Get all available themes (built-in + custom)
 */
export function getAllThemes(): Theme[] {
  return [...builtInThemes, ...customThemes.value];
}

/**
 * Initialize the theme system
 * Sets up effects to sync signals with DOM
 */
export function initTheme(): void {
  // Apply theme whenever it changes
  effect(() => {
    const theme = activeTheme.value;
    applyTheme(theme);
  });

  // Save preference whenever it changes
  effect(() => {
    saveThemePreference(themePreference.value);
  });

  // Listen for system preference changes
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", () => {
    if (themePreference.value.selected === "system") {
      // Force recompute
      themePreference.value = { ...themePreference.value };
    }
  });
}
