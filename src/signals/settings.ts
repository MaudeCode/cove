/**
 * Settings Signals
 *
 * User preferences that persist to localStorage.
 *
 * @see Phase 0.9 in ROADMAP.md for full spec
 */

import { signal, effect } from "@preact/signals";

// ============================================
// Types
// ============================================

export type Theme = "light" | "dark" | "system";
export type TimeFormat = "relative" | "local";
export type FontSize = "sm" | "md" | "lg";
export type FontFamily = "geist" | "inter" | "system" | "dyslexic" | "mono";

// ============================================
// Storage Keys
// ============================================

const STORAGE_KEYS = {
  timeFormat: "cove:time-format",
  fontSize: "cove:font-size",
  fontFamily: "cove:font-family",
} as const;

// ============================================
// Defaults
// ============================================

const DEFAULTS = {
  timeFormat: "relative" as TimeFormat,
  fontSize: "md" as FontSize,
  fontFamily: "system" as FontFamily,
};

// ============================================
// Storage Helpers
// ============================================

function loadSetting<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored) as T;
    }
  } catch {
    // Ignore
  }
  return fallback;
}

function saveSetting<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore
  }
}

// ============================================
// Signals
// ============================================

/** Color theme preference (managed by theme.ts) */
export const theme = signal<Theme>("system");

// Note: locale is managed by i18n.ts, not here

/** How to display timestamps */
export const timeFormat = signal<TimeFormat>(
  loadSetting(STORAGE_KEYS.timeFormat, DEFAULTS.timeFormat),
);

/** UI font size */
export const fontSize = signal<FontSize>(loadSetting(STORAGE_KEYS.fontSize, DEFAULTS.fontSize));

/** Font family preference */
export const fontFamily = signal<FontFamily>(
  loadSetting(STORAGE_KEYS.fontFamily, DEFAULTS.fontFamily),
);

// ============================================
// Persistence Effects
// ============================================

effect(() => saveSetting(STORAGE_KEYS.timeFormat, timeFormat.value));
effect(() => saveSetting(STORAGE_KEYS.fontSize, fontSize.value));
effect(() => saveSetting(STORAGE_KEYS.fontFamily, fontFamily.value));

// ============================================
// DOM Application Effects
// ============================================

/** Apply font size to document */
effect(() => {
  document.documentElement.dataset.fontSize = fontSize.value;
});

/** Apply font family to document */
effect(() => {
  const families: Record<FontFamily, string> = {
    geist: '"Geist", ui-sans-serif, system-ui, sans-serif',
    inter: '"Inter", ui-sans-serif, system-ui, sans-serif',
    system: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    dyslexic: '"OpenDyslexic", ui-sans-serif, system-ui, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, monospace',
  };
  document.documentElement.style.setProperty("--font-family-override", families[fontFamily.value]);
});

// ============================================
// Font Options (for UI)
// ============================================

export const FONT_SIZE_OPTIONS: { value: FontSize; labelKey: string }[] = [
  { value: "sm", labelKey: "settings.appearance.fontSizeSm" },
  { value: "md", labelKey: "settings.appearance.fontSizeMd" },
  { value: "lg", labelKey: "settings.appearance.fontSizeLg" },
];

export const FONT_FAMILY_OPTIONS: { value: FontFamily; labelKey: string }[] = [
  { value: "system", labelKey: "settings.appearance.fontSystem" },
  { value: "geist", labelKey: "settings.appearance.fontGeist" },
  { value: "inter", labelKey: "settings.appearance.fontInter" },
  { value: "mono", labelKey: "settings.appearance.fontMono" },
  { value: "dyslexic", labelKey: "settings.appearance.fontDyslexic" },
];
