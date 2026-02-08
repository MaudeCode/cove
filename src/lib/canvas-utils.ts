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
 * Create a blob URL from base64 data
 * Handles both raw base64 and data URL format (data:mime;base64,...)
 */
export function createBlobUrlFromBase64(base64: string, mimeType: string): string {
  let rawBase64 = base64;
  let detectedMime = mimeType;

  // Handle data URL format
  if (base64.startsWith("data:")) {
    const match = base64.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      detectedMime = match[1];
      rawBase64 = match[2];
    }
  }

  const binary = atob(rawBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: detectedMime });
  return URL.createObjectURL(blob);
}
