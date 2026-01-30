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

// Storage keys (must match inline script in index.html)
const STORAGE_KEY = "cove:theme-preference";
const CUSTOM_THEMES_KEY = "cove:custom-themes";
const CACHE_KEY = "cove:theme-cache";

/** Current theme preference */
export const themePreference = signal<ThemePreference>(loadPreference());

/** Custom themes (user-created) */
export const customThemes = signal<Theme[]>(loadCustomThemes());

/** The currently active theme (resolved) */
export const activeTheme = computed<Theme>(() => {
  const pref = themePreference.value;
  const customs = customThemes.value;

  if (pref.selected === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const themeId = prefersDark ? pref.darkTheme : pref.lightTheme;
    return getTheme(themeId, customs) ?? getTheme("dark", customs)!;
  }

  return getTheme(pref.selected, customs) ?? getTheme("dark", customs)!;
});

/** Current appearance (light or dark) */
export const appearance = computed(() => activeTheme.value.appearance);

/**
 * Load preference from localStorage
 */
function loadPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_THEME_PREFERENCE, ...JSON.parse(stored) };
    }
  } catch {
    // Ignore
  }
  return DEFAULT_THEME_PREFERENCE;
}

/**
 * Save preference to localStorage
 */
function savePreference(pref: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pref));
  } catch {
    // Ignore
  }
}

/**
 * Load custom themes from localStorage
 */
function loadCustomThemes(): Theme[] {
  try {
    const stored = localStorage.getItem(CUSTOM_THEMES_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore
  }
  return [];
}

/**
 * Save custom themes to localStorage
 */
function saveCustomThemes(themes: Theme[]): void {
  try {
    localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(themes));
  } catch {
    // Ignore
  }
}

/**
 * Apply a theme's CSS variables to the document
 */
export function applyThemeColors(colors: ThemeColors): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(colors)) {
    root.style.setProperty(key, value);
  }
}

/**
 * Cache the theme for the inline script (prevents FOUC on reload)
 */
function cacheTheme(theme: Theme): void {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        id: theme.id,
        appearance: theme.appearance,
        colors: theme.colors,
      }),
    );
  } catch {
    // Ignore
  }
}

/**
 * Apply the current theme to the document
 */
export function applyTheme(theme: Theme): void {
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
 * Add a custom theme
 */
export function addCustomTheme(theme: Theme): void {
  const themes = [...customThemes.value.filter((t) => t.id !== theme.id), theme];
  customThemes.value = themes;
  saveCustomThemes(themes);
}

/**
 * Remove a custom theme
 */
export function removeCustomTheme(themeId: string): void {
  const themes = customThemes.value.filter((t) => t.id !== themeId);
  customThemes.value = themes;
  saveCustomThemes(themes);

  // If this was the active theme, switch to default
  if (themePreference.value.selected === themeId) {
    setTheme("system");
  }
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
    savePreference(themePreference.value);
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
