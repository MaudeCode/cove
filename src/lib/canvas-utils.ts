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
