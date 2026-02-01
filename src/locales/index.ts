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
import { log } from "@/lib/logger";

// Type for locale strings (derived from English as source of truth)
export type LocaleStrings = typeof en;

// Supported locales
const supportedLocales = [
  { code: "en", name: "English", nativeName: "English" },
  // Future locales:
  // { code: 'es', name: 'Spanish', nativeName: 'Español' },
  // { code: 'de', name: 'German', nativeName: 'Deutsch' },
  // { code: 'fr', name: 'French', nativeName: 'Français' },
  // { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  // { code: 'ar', name: 'Arabic', nativeName: 'العربية', rtl: true },
] as const;

type SupportedLocale = (typeof supportedLocales)[number]["code"];

// Cache for loaded locales
const localeCache: Record<string, LocaleStrings> = {
  en,
};

/* eslint-disable no-unused-vars -- i18n utilities for future use */

/**
 * Check if a locale is supported
 */
export function isSupported(locale: string): locale is SupportedLocale {
  return supportedLocales.some((l) => l.code === locale);
}

/**
 * Get locale info
 */
export function getLocaleInfo(locale: string) {
  return supportedLocales.find((l) => l.code === locale);
}

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

/**
 * Load a locale asynchronously (for lazy loading)
 */
export async function loadLocale(locale: string): Promise<LocaleStrings> {
  // Return from cache if available
  if (localeCache[locale]) {
    return localeCache[locale];
  }

  // Lazy load based on locale
  // Add cases here as locales are added
  try {
    switch (locale) {
      case "en":
        return en;
      // Future:
      // case 'es':
      //   const es = await import('./es.json')
      //   localeCache.es = es.default
      //   return es.default
      default:
        // Try base locale
        const baseLocale = locale.split("-")[0];
        if (baseLocale !== locale) {
          return loadLocale(baseLocale);
        }
        return en;
    }
  } catch {
    log.i18n.warn(`Failed to load locale: ${locale}, falling back to en`);
    return en;
  }
}

/**
 * Get all available locales for UI
 */
export function getAvailableLocales() {
  return supportedLocales.map((l) => ({
    code: l.code,
    name: l.name,
    nativeName: l.nativeName,
  }));
}

/* eslint-enable no-unused-vars */
