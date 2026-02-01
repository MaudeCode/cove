/**
 * Locale Management
 *
 * Handles loading and caching of locale strings.
 * Currently supports: en
 *
 * To add a new locale:
 * 1. Create src/locales/{locale}.json
 * 2. Add to supportedLocales below
 * 3. Add lazy import in loadLocale()
 */

import en from "./en.json";

// Type for locale strings (derived from English as source of truth)
export type LocaleStrings = typeof en;

// Cache for loaded locales
const localeCache: Record<string, LocaleStrings> = {
  en,
};

/**
 * Get strings for a locale (sync, from cache or fallback)
 */
export function getLocaleStrings(locale: string): LocaleStrings {
  // Try exact match
  if (localeCache[locale]) {
    return localeCache[locale];
  }

  // Try base locale (e.g., 'en-US' -> 'en')
  const baseLocale = locale.split("-")[0];
  if (localeCache[baseLocale]) {
    return localeCache[baseLocale];
  }

  // Fallback to English
  return localeCache.en;
}
