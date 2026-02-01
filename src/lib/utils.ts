/**
 * General Utilities
 *
 * Common helper functions used throughout the app.
 */

/* eslint-disable no-unused-vars -- Utilities for future use */

/**
 * Combines class names, filtering out falsy values
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Generates a unique ID
 */
export function uid(): string {
  return Math.random().toString(36).slice(2, 11);
}

/**
 * Debounce function execution
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  ms: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Clamp a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/* eslint-enable no-unused-vars */

/**
 * Capitalize the first letter of a string
 */
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
