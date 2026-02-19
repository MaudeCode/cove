/**
 * Timezone Utilities
 *
 * Shared IANA timezone helpers used across views/forms.
 */

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Singapore",
  "America/Sao_Paulo",
  "America/Mexico_City",
  "Australia/Sydney",
  "Pacific/Auckland",
] as const;

const SUPPORTED_TIMEZONES: string[] = (() => {
  try {
    if ("supportedValuesOf" in Intl && typeof Intl.supportedValuesOf === "function") {
      return Intl.supportedValuesOf("timeZone");
    }
  } catch {
    // Ignore runtime Intl API incompatibilities and fall back to common timezones.
  }
  return [];
})();

const LOCAL_TIMEZONE: string[] = (() => {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return timeZone ? [timeZone] : [];
  } catch {
    return [];
  }
})();

export const TIMEZONE_SUGGESTIONS = Array.from(
  new Set([...LOCAL_TIMEZONE, ...COMMON_TIMEZONES, ...SUPPORTED_TIMEZONES]),
);

export const TIMEZONE_QUICK_PICKS = Array.from(new Set([...LOCAL_TIMEZONE, ...COMMON_TIMEZONES]));

/**
 * Return a capped, relevance-sorted set of timezone suggestions for a query.
 */
export function getTimeZoneSuggestions(query: string, limit = 12): string[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return TIMEZONE_QUICK_PICKS.slice(0, limit);
  }

  const startsWith: string[] = [];
  const contains: string[] = [];
  for (const timeZone of TIMEZONE_SUGGESTIONS) {
    const lower = timeZone.toLowerCase();
    if (lower.startsWith(normalized)) {
      startsWith.push(timeZone);
    } else if (lower.includes(normalized)) {
      contains.push(timeZone);
    }
  }
  return [...startsWith, ...contains].slice(0, limit);
}

/**
 * Check whether a timezone string is a valid IANA timezone identifier.
 */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone }).format(0);
    return true;
  } catch {
    return false;
  }
}
