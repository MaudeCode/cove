/**
 * Canvas Utilities
 *
 * Shared helpers for canvas content rendering.
 */

/**
 * Check if a content type is an image MIME type
 */
export function isImageContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  return contentType.startsWith("image/");
}

/**
 * Check if a URL looks like an image based on file extension
 */
export function isImageUrl(url: string | null): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return /\.(png|jpg|jpeg|gif|webp|svg|ico|bmp)(\?|$)/.test(lower);
}

/**
 * Extract the MIME type from a base64 data URL.
 */
export function getDataUrlMimeType(base64: string): string | null {
  return parseBase64DataUrl(base64)?.mimeType ?? null;
}

/**
 * Create a blob URL from base64 data
 * Handles both raw base64 and data URL format (data:mime;base64,...)
 */
export function createBlobUrlFromBase64(base64: string, mimeType: string): string {
  let rawBase64 = base64;
  let detectedMime = mimeType;

  // Handle data URL format
  const dataUrl = parseBase64DataUrl(base64);
  if (dataUrl) {
    detectedMime = dataUrl.mimeType;
    rawBase64 = dataUrl.base64;
  }

  let binary: string;
  try {
    binary = atob(rawBase64);
  } catch {
    throw new Error("Invalid base64 data");
  }

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: detectedMime });
  return URL.createObjectURL(blob);
}

function parseBase64DataUrl(base64: string): { base64: string; mimeType: string } | null {
  const match = base64.match(/^data:([^;]+);base64,(.*)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}
