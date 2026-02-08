/**
 * Canvas Receiver
 *
 * Lightweight module for receiving canvas content via BroadcastChannel.
 * Used by the standalone /canvas page to avoid loading full node-connection.
 */

import { signal } from "@preact/signals";

export const canvasUrl = signal<string | null>(null);
export const canvasBlobUrl = signal<string | null>(null);
export const canvasContentType = signal<string | null>(null);
export const canvasContent = signal<string | null>(null);

const canvasChannel =
  typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("cove:canvas") : null;

/**
 * Create a blob URL from base64 data
 */
function createBlobUrlFromBase64(base64: string, mimeType: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

// Listen for canvas content from main chat
canvasChannel?.addEventListener("message", (e) => {
  if (e.data.type === "canvas-content") {
    if (e.data.url) {
      canvasUrl.value = e.data.url;
      canvasBlobUrl.value = null;
      canvasContentType.value = null;
    } else if (e.data.base64) {
      try {
        // Revoke previous blob URL
        if (canvasBlobUrl.value) {
          URL.revokeObjectURL(canvasBlobUrl.value);
        }
        const blobUrl = createBlobUrlFromBase64(e.data.base64, e.data.mimeType || "image/png");
        canvasBlobUrl.value = blobUrl;
        canvasContentType.value = e.data.mimeType;
        canvasUrl.value = null;
      } catch {
        // Ignore errors
      }
    }
  }
});

/**
 * Announce that standalone canvas is open/closed
 */
export function announceStatus(open: boolean) {
  canvasChannel?.postMessage({ type: "canvas-standalone-status", open });
}
