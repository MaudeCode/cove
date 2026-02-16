/**
 * General Utilities
 *
 * Common helper functions used throughout the app.
 */

/**
 * Capitalize the first letter of a string
 */
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Check if an avatar string is a URL (vs emoji/initials)
 */
export function isAvatarUrl(avatar: string | undefined): boolean {
  if (!avatar) return false;
  return (
    avatar.startsWith("http://") || avatar.startsWith("https://") || avatar.startsWith("data:")
  );
}

/**
 * Check if a string has content (non-empty after trimming)
 */
export function hasContent(s?: string | null): s is string {
  return typeof s === "string" && s.trim().length > 0;
}

/**
 * Format a value as pretty-printed JSON string.
 * Falls back to String() if JSON.stringify fails.
 */
export function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

interface FormatUptimeOptions {
  /** Include minutes when showing day-level uptime (e.g. "2d 3h 15m") */
  includeMinutesWhenDays?: boolean;
}

/**
 * Format uptime milliseconds into a compact duration string.
 */
export function formatUptime(ms: number, options?: FormatUptimeOptions): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    if (options?.includeMinutesWhenDays) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    }
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Strip markdown formatting from text, returning plain text.
 * Useful for copying "formatted" content without markdown syntax.
 */
export function stripMarkdown(markdown: string): string {
  return (
    markdown
      // Bold/italic
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/__(.+?)__/g, "$1")
      .replace(/_(.+?)_/g, "$1")
      // Strikethrough
      .replace(/~~(.+?)~~/g, "$1")
      // Inline code
      .replace(/`(.+?)`/g, "$1")
      // Headers
      .replace(/^#{1,6}\s+/gm, "")
      // Bullet lists → bullet character
      .replace(/^\s*[-*+]\s+/gm, "• ")
      // Numbered lists → remove numbers
      .replace(/^\s*\d+\.\s+/gm, "")
      // Links → just the text
      .replace(/\[(.+?)\]\(.+?\)/g, "$1")
      // Images → remove entirely
      .replace(/!\[.*?\]\(.+?\)/g, "")
      // Blockquotes
      .replace(/^>\s+/gm, "")
      // Code blocks → just the code
      .replace(/```[\s\S]*?```/g, (match) => {
        return match.replace(/```\w*\n?/, "").replace(/```$/, "");
      })
      .trim()
  );
}
