/**
 * CanvasPanel
 *
 * Displays content pushed by the agent via canvas commands.
 * Slide-out drawer with a persistent handle on the right edge.
 */

import {
  canvasVisible,
  canvasUrl,
  canvasContent,
  canvasBlobUrl,
  canvasContentType,
} from "@/lib/node-connection";
import { X, ExternalLink, ChevronLeft, ChevronRight } from "lucide-preact";
import { signal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { IconButton } from "@/components/ui/IconButton";
import { t } from "@/lib/i18n";

// Panel state
const panelWidth = signal(420);
const isOpen = signal(false);

// Constraints
const MIN_WIDTH = 320;
const MAX_WIDTH_PERCENT = 0.7;

// Sync isOpen with canvasVisible (auto-open when content arrives)
function syncOpenState() {
  if (canvasVisible.value && !isOpen.value) {
    isOpen.value = true;
  }
}

/**
 * Check if a content type is an image
 */
function isImageContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  return contentType.startsWith("image/");
}

/**
 * Check if a URL looks like an image (by extension)
 */
function isImageUrl(url: string | null): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return /\.(png|jpg|jpeg|gif|webp|svg|ico|bmp)(\?|$)/.test(lower);
}

/**
 * Render the canvas content based on type
 */
function renderCanvasContent(url: string | null, content: string | null) {
  const blobUrl = canvasBlobUrl.value;
  const contentType = canvasContentType.value;

  // If we have a blob URL, use it
  if (blobUrl) {
    // Check if it's an image
    if (isImageContentType(contentType) || isImageUrl(url)) {
      return (
        <div class="w-full h-full flex items-center justify-center bg-[var(--color-bg-secondary)] p-4">
          <img
            src={blobUrl}
            alt="Canvas content"
            class="max-w-full max-h-full object-contain rounded shadow-lg"
          />
        </div>
      );
    }
    // Non-image blob - try to render in iframe
    return (
      <iframe
        src={blobUrl}
        class="w-full h-full border-0 bg-white"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        title={t("canvas.iframeTitle")}
      />
    );
  }

  // Fall back to direct URL (may fail due to auth/CORS)
  if (url) {
    // Check if it looks like an image URL
    if (isImageUrl(url)) {
      return (
        <div class="w-full h-full flex items-center justify-center bg-[var(--color-bg-secondary)] p-4">
          <img
            src={url}
            alt="Canvas content"
            class="max-w-full max-h-full object-contain rounded shadow-lg"
          />
        </div>
      );
    }
    // Regular URL - use iframe
    return (
      <iframe
        src={url}
        class="w-full h-full border-0 bg-white"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        title={t("canvas.iframeTitle")}
      />
    );
  }

  // HTML content
  if (content) {
    return (
      <div
        class="w-full h-full p-4 overflow-auto"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  // Empty state
  return (
    <div class="flex flex-col items-center justify-center h-full gap-3 text-[var(--color-text-muted)] px-6 text-center">
      <p class="text-sm">{t("canvas.noContent")}</p>
      <p class="text-xs opacity-70">The assistant can push content here during conversations.</p>
    </div>
  );
}

export function CanvasPanel() {
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  // Auto-open when canvas becomes visible
  useEffect(() => {
    return canvasVisible.subscribe(syncOpenState);
  }, []);

  // Handle resize drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startX.current - e.clientX;
      const maxWidth = window.innerWidth * MAX_WIDTH_PERCENT;
      const newWidth = Math.min(maxWidth, Math.max(MIN_WIDTH, startWidth.current + delta));
      panelWidth.value = newWidth;
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen.value) {
        isOpen.value = false;
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleResizeStart = (e: MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = panelWidth.value;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const url = canvasUrl.value;
  const content = canvasContent.value;
  const hasContent = !!(url || content);

  return (
    <>
      {/* Handle tab - always visible on right edge */}
      <button
        onClick={() => (isOpen.value = !isOpen.value)}
        class={`
          fixed top-1/2 -translate-y-1/2 z-40
          flex items-center justify-center
          w-6 h-16 rounded-l-lg
          bg-[var(--color-bg-secondary)] border border-r-0 border-[var(--color-border)]
          hover:bg-[var(--color-bg-tertiary)] hover:w-7
          transition-all duration-200 ease-out
          shadow-lg
          ${isOpen.value ? "right-[var(--canvas-width)]" : "right-0"}
        `}
        style={
          {
            "--canvas-width": `${panelWidth.value}px`,
          } as React.CSSProperties
        }
        aria-label={isOpen.value ? t("canvas.close") : t("canvas.title")}
        aria-expanded={isOpen.value}
      >
        {isOpen.value ? (
          <ChevronRight class="w-4 h-4 text-[var(--color-text-muted)]" />
        ) : (
          <ChevronLeft class="w-4 h-4 text-[var(--color-text-muted)]" />
        )}
        {/* Indicator dot when there's content but panel is closed */}
        {!isOpen.value && hasContent && (
          <span class="absolute top-2 right-1 w-2 h-2 rounded-full bg-[var(--color-accent)]" />
        )}
      </button>

      {/* Drawer panel */}
      <div
        class={`
          fixed top-0 right-0 h-full z-30
          bg-[var(--color-bg)] border-l border-[var(--color-border)]
          shadow-2xl
          flex flex-col
          transition-transform duration-300 ease-out
          ${isOpen.value ? "translate-x-0" : "translate-x-full"}
        `}
        style={{ width: `${panelWidth.value}px` }}
      >
        {/* Resize handle */}
        <div
          onMouseDown={handleResizeStart}
          class="absolute left-0 top-0 w-1 h-full cursor-col-resize hover:bg-[var(--color-accent)]/30 active:bg-[var(--color-accent)]/50 transition-colors z-10"
        />

        {/* Header */}
        <div class="flex items-center justify-between px-3 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <span class="text-sm font-medium text-[var(--color-text)]">{t("canvas.title")}</span>
            {url && (
              <span class="text-xs text-[var(--color-text-muted)] truncate">
                {(() => {
                  try {
                    return new URL(url).hostname;
                  } catch {
                    return url;
                  }
                })()}
              </span>
            )}
          </div>
          <div class="flex items-center gap-0.5">
            {url && (
              <IconButton
                icon={ExternalLink}
                label={t("canvas.openInNewTab")}
                size="sm"
                onClick={() => window.open(url, "_blank")}
              />
            )}
            <IconButton
              icon={X}
              label={t("canvas.close")}
              size="sm"
              onClick={() => (isOpen.value = false)}
            />
          </div>
        </div>

        {/* Content */}
        <div class="flex-1 overflow-hidden">{renderCanvasContent(url, content)}</div>
      </div>

      {/* Backdrop when open on mobile */}
      {isOpen.value && (
        <button
          type="button"
          class="fixed inset-0 bg-black/20 z-20 md:hidden cursor-default border-0 p-0 m-0"
          onClick={() => (isOpen.value = false)}
          onKeyDown={(e) => e.key === "Escape" && (isOpen.value = false)}
          tabIndex={-1}
          aria-label={t("canvas.close")}
        />
      )}
    </>
  );
}
