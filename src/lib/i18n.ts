/**
 * Internationalization (i18n) System
 *
 * Provides translation and locale-aware formatting.
 *
 * Usage:
 *   import { t, formatDate, formatRelativeTime } from '@/lib/i18n'
 *
 *   t('actions.send')           // "Send"
 *   t('messages.count', { count: 5 })  // "5 messages"
 *   formatDate(new Date())      // "Jan 30, 2026"
 *   formatRelativeTime(date)    // "2 hours ago"
 */

import { signal, effect, computed } from "@preact/signals";
import { getLocaleStrings, type LocaleStrings } from "@/locales";
import { timeFormat } from "@/signals/settings";
import { log } from "./logger";

// Storage key
const STORAGE_KEY = "cove:locale";

/** Current locale code */
export const locale = signal<string>(loadLocale());

/** Current locale strings */
export const strings = signal<LocaleStrings>(getLocaleStrings(locale.value));

/** Whether current locale is RTL */
export const isRTL = computed(() => {
  const rtlLocales = ["ar", "he", "fa", "ur"];
  return rtlLocales.includes(locale.value.split("-")[0]);
});

/**
 * Load locale from storage or detect from browser
 */
function loadLocale(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      // Fix: previous bug saved JSON-stringified values like '"en"'
      // Strip quotes if present
      const cleaned = stored.replace(/^"|"$/g, "");
      if (cleaned && cleaned !== stored) {
        // Fix the stored value
        localStorage.setItem(STORAGE_KEY, cleaned);
      }
      return cleaned || "en";
    }
  } catch {
    // Ignore
  }

  // Detect from browser
  const browserLocale = navigator.language || "en";
  // For now, we only support 'en', so normalize
  return browserLocale.startsWith("en") ? "en" : "en";
}

/**
 * Save locale to storage
 */
function saveLocale(loc: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, loc);
  } catch {
    // Ignore
  }
}

/**
 * Set the current locale
 */
export function setLocale(loc: string): void {
  locale.value = loc;
  strings.value = getLocaleStrings(loc);
  saveLocale(loc);

  // Update document direction for RTL
  document.documentElement.dir = isRTL.value ? "rtl" : "ltr";
  document.documentElement.lang = loc;
}

/**
 * Initialize i18n system
 */
export function initI18n(): void {
  // Set initial direction and lang
  document.documentElement.dir = isRTL.value ? "rtl" : "ltr";
  document.documentElement.lang = locale.value;

  // Sync on locale changes
  effect(() => {
    document.documentElement.dir = isRTL.value ? "rtl" : "ltr";
    document.documentElement.lang = locale.value;
  });
}

/**
 * Get a nested value from an object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((acc: unknown, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Translate a key with optional interpolation
 *
 * @param key - Dot-notation key (e.g., 'actions.send')
 * @param params - Interpolation values (e.g., { count: 5 })
 * @returns Translated string or the key if not found
 *
 * @example
 * t('actions.send')                    // "Send"
 * t('messages.count', { count: 5 })    // "5 messages"
 * t('time.minutesAgo', { count: 2 })   // "2 minutes ago" (with pluralization)
 */
export function t(key: string, params?: Record<string, string | number>): string {
  let value = getNestedValue(strings.value as Record<string, unknown>, key);

  // Handle pluralization
  if (params?.count !== undefined && typeof params.count === "number") {
    const count = params.count;
    const pluralKey = count === 1 ? key : `${key}_plural`;
    const pluralValue = getNestedValue(strings.value as Record<string, unknown>, pluralKey);
    if (pluralValue !== undefined) {
      value = pluralValue;
    }
  }

  // Return key if not found
  if (typeof value !== "string") {
    log.i18n.warn(`Missing translation: ${key}`);
    return key;
  }

  // Interpolate params
  if (params) {
    return value.replace(/\{(\w+)\}/g, (_, paramKey) => {
      return params[paramKey]?.toString() ?? `{${paramKey}}`;
    });
  }

  return value;
}

// ============================================
// Date/Time/Number Formatting
// ============================================

type DateStyle = "short" | "medium" | "long" | "full";
type TimeStyle = "short" | "medium" | "long";

/**
 * Format a date
 *
 * @example
 * formatDate(new Date(), 'medium')  // "Jan 30, 2026"
 */
export function formatDate(date: Date | number, style: DateStyle = "medium"): string {
  const d = typeof date === "number" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale.value, { dateStyle: style }).format(d);
}

/**
 * Format a time
 *
 * @example
 * formatTime(new Date(), 'short')  // "3:45 PM"
 */
export function formatTime(date: Date | number, style: TimeStyle = "short"): string {
  const d = typeof date === "number" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale.value, { timeStyle: style }).format(d);
}

/**
 * Format a date and time
 *
 * @example
 * formatDateTime(new Date())  // "Jan 30, 2026, 3:45 PM"
 */
export function formatDateTime(
  date: Date | number,
  dateStyle: DateStyle = "medium",
  timeStyle: TimeStyle = "short",
): string {
  const d = typeof date === "number" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale.value, { dateStyle, timeStyle }).format(d);
}

/**
 * Format a relative time (e.g., "2 hours ago", "in 5 minutes")
 *
 * @example
 * formatRelativeTime(pastDate)    // "2 hours ago"
 * formatRelativeTime(futureDate)  // "in 5 minutes"
 */
export function formatRelativeTime(date: Date | number): string {
  const d = typeof date === "number" ? new Date(date) : date;
  const now = Date.now();
  const diffMs = d.getTime() - now;
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);
  const diffWeek = Math.round(diffDay / 7);
  const diffMonth = Math.round(diffDay / 30);
  const diffYear = Math.round(diffDay / 365);

  const rtf = new Intl.RelativeTimeFormat(locale.value, { numeric: "auto" });

  if (Math.abs(diffSec) < 60) {
    return rtf.format(diffSec, "second");
  } else if (Math.abs(diffMin) < 60) {
    return rtf.format(diffMin, "minute");
  } else if (Math.abs(diffHour) < 24) {
    return rtf.format(diffHour, "hour");
  } else if (Math.abs(diffDay) < 7) {
    return rtf.format(diffDay, "day");
  } else if (Math.abs(diffWeek) < 4) {
    return rtf.format(diffWeek, "week");
  } else if (Math.abs(diffMonth) < 12) {
    return rtf.format(diffMonth, "month");
  } else {
    return rtf.format(diffYear, "year");
  }
}

/**
 * Format a timestamp based on user preference (relative or absolute).
 * Use this for UI timestamps that should respect the setting.
 *
 * @example
 * formatTimestamp(date)  // "2 hours ago" or "3:45 PM" depending on setting
 */
export function formatTimestamp(date: Date | number): string {
  if (timeFormat.value === "local") {
    return formatTime(date, "short");
  }
  return formatRelativeTime(date);
}

/**
 * Format relative time in compact form (e.g., "6h", "2d", "3w")
 *
 * @example
 * formatRelativeTimeCompact(pastDate)  // "6h"
 * formatRelativeTimeCompact(olderDate) // "2d"
 */
export function formatRelativeTimeCompact(date: Date | number): string {
  const d = typeof date === "number" ? new Date(date) : date;
  const now = Date.now();
  const diffMs = Math.abs(d.getTime() - now);
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);
  const diffWeek = Math.round(diffDay / 7);
  const diffMonth = Math.round(diffDay / 30);
  const diffYear = Math.round(diffDay / 365);

  if (diffSec < 60) {
    return t("time.compact.now");
  } else if (diffMin < 60) {
    return t("time.compact.minutes", { count: diffMin });
  } else if (diffHour < 24) {
    return t("time.compact.hours", { count: diffHour });
  } else if (diffDay < 7) {
    return t("time.compact.days", { count: diffDay });
  } else if (diffWeek < 4) {
    return t("time.compact.weeks", { count: diffWeek });
  } else if (diffMonth < 12) {
    return t("time.compact.months", { count: diffMonth });
  } else {
    return t("time.compact.years", { count: diffYear });
  }
}

/**
 * Format a number
 *
 * @example
 * formatNumber(1234567.89)  // "1,234,567.89"
 * formatNumber(0.5, { style: 'percent' })  // "50%"
 */
export function formatNumber(num: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale.value, options).format(num);
}

/**
 * Format bytes to human readable string
 *
 * @example
 * formatBytes(1024)       // "1 KB"
 * formatBytes(1048576)    // "1 MB"
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/**
 * Format duration in milliseconds to human readable string
 *
 * @example
 * formatDuration(5000)    // "5s"
 * formatDuration(125000)  // "2m 5s"
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;

  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / 60000) % 60;
  const hours = Math.floor(ms / 3600000);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}
