/**
 * Canvas Receiver
 *
 * Lightweight module for receiving canvas content via BroadcastChannel.
 * Used by the standalone /canvas page to avoid loading full node-connection.
 */

import { signal } from "@preact/signals";
import { createBlobUrlFromBase64 } from "./canvas-utils";

export const canvasUrl = signal<string | null>(null);
export const canvasBlobUrl = signal<string | null>(null);
export const canvasContentType = signal<string | null>(null);
export const canvasContent = signal<string | null>(null);

const canvasChannel =
  typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("cove:canvas") : null;

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
