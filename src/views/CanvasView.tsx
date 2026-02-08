/**
 * CanvasView
 *
 * Standalone canvas page for multi-window/monitor setups.
 * Shows canvas content in full viewport, no panel chrome.
 */

import { useEffect } from "preact/hooks";
import {
  canvasUrl,
  canvasContent,
  canvasBlobUrl,
  canvasContentType,
  announceStatus,
} from "@/lib/canvas-receiver";
import { t } from "@/lib/i18n";
import { isImageContentType, isImageUrl } from "@/lib/canvas-utils";

export function CanvasView() {
  // Broadcast that standalone canvas is open
  useEffect(() => {
    announceStatus(true);

    const handleUnload = () => announceStatus(false);
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      handleUnload();
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, []);

  const url = canvasUrl.value;
  const content = canvasContent.value;
  const blobUrl = canvasBlobUrl.value;
  const contentType = canvasContentType.value;

  // Render content based on type
  const renderContent = () => {
    // If we have a blob URL, use it
    if (blobUrl) {
      if (isImageContentType(contentType) || isImageUrl(url)) {
        return (
          <div class="w-full h-full flex items-center justify-center bg-[var(--color-bg-primary)] p-4">
            <img
              src={blobUrl}
              alt={t("canvas.imageAlt")}
              class="max-w-full max-h-full object-contain"
            />
          </div>
        );
      }
      return (
        <iframe
          src={blobUrl}
          class="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          title={t("canvas.iframeTitle")}
        />
      );
    }

    // Fall back to direct URL
    if (url) {
      if (isImageUrl(url)) {
        return (
          <div class="w-full h-full flex items-center justify-center bg-[var(--color-bg-primary)] p-4">
            <img
              src={url}
              alt={t("canvas.imageAlt")}
              class="max-w-full max-h-full object-contain"
            />
          </div>
        );
      }
      return (
        <iframe
          src={url}
          class="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          title={t("canvas.iframeTitle")}
        />
      );
    }

    // HTML content
    if (content) {
      return (
        <div
          class="w-full h-full p-4 overflow-auto bg-[var(--color-bg-primary)]"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: content }}
        />
      );
    }

    // Empty state
    return (
      <div class="flex flex-col items-center justify-center h-full gap-4 text-[var(--color-text-muted)] px-6 text-center bg-[var(--color-bg-primary)]">
        <div class="text-6xl">🖼️</div>
        <p class="text-lg">{t("canvas.noContent")}</p>
        <p class="text-sm opacity-70">{t("canvas.noContentHint")}</p>
      </div>
    );
  };

  return (
    <div class="w-screen h-screen overflow-hidden bg-[var(--color-bg-primary)]">
      {renderContent()}
    </div>
  );
}
