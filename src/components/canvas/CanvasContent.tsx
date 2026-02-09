/**
 * CanvasContent
 *
 * Shared content renderer for canvas panel and standalone canvas view.
 */

import type { RefObject } from "preact";
import { t } from "@/lib/i18n";
import { isImageContentType, isImageUrl } from "@/lib/canvas-utils";

export interface CanvasContentProps {
  url: string | null;
  blobUrl: string | null;
  contentType: string | null;
  content: string | null;
  iframeRef?: RefObject<HTMLIFrameElement>;
  imgRef?: RefObject<HTMLImageElement>;
  /** Show larger empty state (for standalone view) */
  largeEmptyState?: boolean;
}

/**
 * Render canvas content based on type (image, iframe, or HTML)
 */
export function CanvasContent({
  url,
  blobUrl,
  contentType,
  content,
  iframeRef,
  imgRef,
  largeEmptyState = false,
}: CanvasContentProps) {
  // If we have a blob URL, use it
  if (blobUrl) {
    if (isImageContentType(contentType) || isImageUrl(url)) {
      return (
        <div class="w-full h-full flex items-center justify-center bg-[var(--color-bg-tertiary)] p-4 overflow-auto">
          <img
            ref={imgRef}
            src={blobUrl}
            alt={t("canvas.imageAlt")}
            class="max-w-full max-h-full object-contain rounded-lg shadow-lg"
            crossOrigin="anonymous"
          />
        </div>
      );
    }
    return (
      <div class="w-full h-full overflow-hidden">
        <iframe
          ref={iframeRef}
          src={blobUrl}
          class="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          title={t("canvas.iframeTitle")}
        />
      </div>
    );
  }

  // Fall back to direct URL
  if (url) {
    if (isImageUrl(url)) {
      return (
        <div class="w-full h-full flex items-center justify-center bg-[var(--color-bg-tertiary)] p-4 overflow-auto">
          <img
            ref={imgRef}
            src={url}
            alt={t("canvas.imageAlt")}
            class="max-w-full max-h-full object-contain rounded-lg shadow-lg"
            crossOrigin="anonymous"
          />
        </div>
      );
    }
    return (
      <div class="w-full h-full overflow-hidden">
        <iframe
          ref={iframeRef}
          src={url}
          class="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          title={t("canvas.iframeTitle")}
        />
      </div>
    );
  }

  // HTML content (legacy)
  if (content) {
    return (
      <div
        class="w-full h-full p-4 overflow-auto bg-[var(--color-bg-tertiary)]"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  // Empty state
  if (largeEmptyState) {
    return (
      <div class="flex flex-col items-center justify-center h-full gap-4 text-[var(--color-text-muted)] px-6 text-center bg-[var(--color-bg-primary)]">
        <div class="text-6xl">🖼️</div>
        <p class="text-lg">{t("canvas.noContent")}</p>
        <p class="text-sm opacity-70">{t("canvas.noContentHint")}</p>
      </div>
    );
  }

  return (
    <div class="flex flex-col items-center justify-center h-full gap-3 text-[var(--color-text-muted)] px-6 text-center">
      <p class="text-sm">{t("canvas.noContent")}</p>
      <p class="text-xs opacity-70">{t("canvas.noContentHint")}</p>
    </div>
  );
}
