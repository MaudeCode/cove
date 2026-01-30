/**
 * Locale Loader
 *
 * Lazy-loads locale files and provides the current translations.
 */

import en from "./en.json";

export type LocaleStrings = typeof en;

const locales: Record<string, LocaleStrings> = {
  en,
};

/**
 * Get translations for a locale
 */
export function getLocaleStrings(locale: string): LocaleStrings {
  return locales[locale] ?? locales.en;
}

/**
 * Load a locale (for lazy loading additional locales)
 */
export async function loadLocale(locale: string): Promise<LocaleStrings> {
  if (locales[locale]) {
    return locales[locale];
  }

  // TODO: Lazy load other locales
  // const strings = await import(`./${locale}.json`)
  // locales[locale] = strings.default
  // return strings.default

  return locales.en;
}
