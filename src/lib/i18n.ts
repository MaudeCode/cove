/**
 * Internationalization (i18n) System
 *
 * Provides translation and locale-aware formatting.
 *
 * Usage:
 *   import { t, formatTimestamp } from '@/lib/i18n'
 *
 *   t('actions.send')           // "Send"
 *   t('messages.count', { count: 5 })  // "5 messages"
 *   formatTimestamp(date)       // "2 hours ago" or "3:45 PM"
 */

import { signal, effect, computed } from "@preact/signals";
import { getLocaleStrings, type LocaleStrings } from "@/locales";
import { timeFormat } from "@/signals/settings";
import { getLocale } from "./storage";
import { log } from "./logger";

/** Current locale code */
const locale = signal<string>(getLocale());

/** Current locale strings */
const strings = signal<LocaleStrings>(getLocaleStrings(locale.value));

/** Whether current locale is RTL */
const isRTL = computed(() => {
  const rtlLocales = ["ar", "he", "fa", "ur"];
  return rtlLocales.includes(locale.value.split("-")[0]);
});

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
// Date/Time Formatting
// ============================================

type TimeStyle = "short" | "medium" | "long";

/**
 * Format a time
 */
function formatTime(date: Date | number, style: TimeStyle = "short"): string {
  const d = typeof date === "number" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale.value, { timeStyle: style }).format(d);
}

/**
 * Format a relative time (e.g., "2 hours ago", "in 5 minutes")
 */
function formatRelativeTime(date: Date | number): string {
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

interface FormatTimestampOptions {
  /** Force relative time regardless of user setting */
  relative?: boolean;
}

/**
 * Format a timestamp based on user preference (relative or absolute).
 * Use this for UI timestamps that should respect the setting.
 *
 * @example
 * formatTimestamp(date)                    // respects user setting
 * formatTimestamp(date, { relative: true }) // always relative
 */
export function formatTimestamp(date: Date | number, options?: FormatTimestampOptions): string {
  if (options?.relative) {
    return formatRelativeTime(date);
  }
  if (timeFormat.value === "local") {
    return formatTime(date, "short");
  }
  return formatRelativeTime(date);
}

/**
 * Format relative time in compact form (e.g., "6h", "2d", "3w")
 */
function formatRelativeTimeCompact(date: Date | number): string {
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
 * Format timestamp in compact form, respecting timeFormat setting
 *
 * @example
 * // With timeFormat="relative": "6h", "2d"
 * // With timeFormat="local": "3:45 PM" (today), "Jan 31" (this year), "Jan '25" (older)
 */
export function formatTimestampCompact(date: Date | number): string {
  if (timeFormat.value === "local") {
    const d = typeof date === "number" ? new Date(date) : date;
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    if (isToday) {
      // Show time for today
      return formatTime(d, "short");
    } else if (d.getFullYear() === now.getFullYear()) {
      // Show "Jan 31" for this year
      return new Intl.DateTimeFormat(locale.value, {
        month: "short",
        day: "numeric",
      }).format(d);
    } else {
      // Show "Jan '25" for older
      return new Intl.DateTimeFormat(locale.value, {
        month: "short",
        year: "2-digit",
      }).format(d);
    }
  }
  return formatRelativeTimeCompact(date);
}

/**
 * Format bytes to human readable string
 *
 * @example
 * formatBytes(1024)      // "1.0 KB"
 * formatBytes(1048576)   // "1.0 MB"
 * formatBytes(500)       // "500 B"
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format a token count for display.
 *
 * @example
 * formatTokens(500)       // "500"
 * formatTokens(1500)      // "1.5K"
 * formatTokens(15000)     // "15K"
 */
export function formatTokens(tokens: number): string {
  if (tokens < 1000) return `${tokens}`;
  if (tokens < 10000) return `${(tokens / 1000).toFixed(1)}K`;
  return `${Math.round(tokens / 1000)}K`;
}

/**
 * Format a duration in milliseconds for display.
 *
 * @example
 * formatDuration(500)      // "500ms"
 * formatDuration(2300)     // "2.3s"
 * formatDuration(65000)    // "1m 5s"
 * formatDuration(undefined) // "—"
 */
export function formatDuration(ms: number | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}
