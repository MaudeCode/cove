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
