/**
 * Media Parsing
 *
 * Parse MEDIA: lines from message content.
 * Mirrors OpenClaw's media/parse.ts logic for the client side.
 */

import type { MessageImage } from "@/types/messages";

/** MEDIA: token regex - for quick check if content has any MEDIA: lines */
const MEDIA_LINE_RE = /^MEDIA:/im;

/** Check if a URL is a valid remote image URL */
function isRemoteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/** Check if a URL is a data URL (base64 encoded) */
function isDataUrl(url: string): boolean {
  return /^data:/i.test(url);
}

/** Clean up a media URL candidate */
function cleanCandidate(raw: string): string {
  return raw
    .trim()
    .replace(/^[`"'[{(]+/, "")
    .replace(/[`"'\\})\],]+$/, "");
}

export interface ParsedMedia {
  /** Text content with MEDIA: lines removed */
  text: string;
  /** Extracted media URLs (remote URLs and data URLs only) */
  mediaUrls: string[];
  /** Local file paths (for display/warning purposes) */
  localPaths: string[];
}

/**
 * Parse MEDIA: lines from content.
 * Returns cleaned text and extracted media URLs.
 *
 * Only remote URLs (http/https) and data URLs are included in mediaUrls.
 * Local file paths are collected separately for debugging/display.
 */
export function parseMediaFromContent(content: string): ParsedMedia {
  const mediaUrls: string[] = [];
  const localPaths: string[] = [];
  const lines = content.split("\n");
  const keptLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Check if line starts with MEDIA:
    if (!trimmed.startsWith("MEDIA:")) {
      keptLines.push(line);
      continue;
    }

    // Extract the URL/path after MEDIA:
    const payload = trimmed.slice(6).trim();
    const cleaned = cleanCandidate(payload);

    if (!cleaned) {
      keptLines.push(line);
      continue;
    }

    // Check what type of URL/path it is
    if (isRemoteUrl(cleaned) || isDataUrl(cleaned)) {
      mediaUrls.push(cleaned);
    } else {
      // Local file path - can't display in browser, collect for UI indicator
      localPaths.push(cleaned);
    }
  }

  return {
    text: keptLines.join("\n").trim(),
    mediaUrls,
    localPaths,
  };
}

/**
 * Convert parsed media URLs to MessageImage array
 */
export function mediaUrlsToImages(urls: string[]): MessageImage[] {
  return urls.map((url, index) => ({
    url,
    alt: `Image ${index + 1}`,
  }));
}

/**
 * Check if content has any MEDIA: lines
 */
export function hasMediaLines(content: string): boolean {
  return MEDIA_LINE_RE.test(content);
}
