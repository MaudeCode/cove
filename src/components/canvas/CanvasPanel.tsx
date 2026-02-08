/**
 * CanvasPanel
 *
 * Floating panel for agent-pushed content.
 * Can be dragged freely or docked to left/top/right of the viewport.
 */

import {
  canvasVisible,
  canvasUrl,
  canvasContent,
  canvasBlobUrl,
  canvasContentType,
  standaloneCanvasOpen,
} from "@/lib/node-connection";
import { canvasPanelOpen } from "@/signals/ui";
import {
  X,
  ExternalLink,
  GripHorizontal,
  Minimize2,
  Maximize2,
  PictureInPicture2,
} from "lucide-preact";
import { useEffect, useState, useRef } from "preact/hooks";
import { IconButton } from "@/components/ui/IconButton";
import { t } from "@/lib/i18n";
import { isImageContentType, isImageUrl } from "@/lib/canvas-utils";
import {
  dockPosition,
  panelX,
  panelY,
  isMinimized,
  priorDockPosition,
  isInteracting,
  panelStyle,
  HEADER_HEIGHT,
  LG_BREAKPOINT,
} from "./canvas-panel-state";
import { usePanelInteraction } from "./usePanelInteraction";
import { signal } from "@preact/signals";

// Sync panel visibility with canvas state
function syncOpenState() {
  if (canvasVisible.value && !canvasPanelOpen.value) {
    if (standaloneCanvasOpen.value) return;
    canvasPanelOpen.value = true;
    isMinimized.value = false;
  } else if (!canvasVisible.value && canvasPanelOpen.value) {
    canvasPanelOpen.value = false;
  }
}

/**
 * Render the canvas content based on type
 */
function renderCanvasContent(url: string | null, content: string | null) {
  const blobUrl = canvasBlobUrl.value;
  const contentType = canvasContentType.value;

  // If we have a blob URL, use it
  if (blobUrl) {
    if (isImageContentType(contentType) || isImageUrl(url)) {
      return (
        <div class="w-full h-full flex items-center justify-center bg-[var(--color-bg-tertiary)] p-4 overflow-auto">
          <img
            src={blobUrl}
            alt={t("canvas.imageAlt")}
            class="max-w-full max-h-full object-contain rounded-lg shadow-lg"
          />
        </div>
      );
    }
    return (
      <div class="w-full h-full overflow-hidden">
        <iframe
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
            src={url}
            alt={t("canvas.imageAlt")}
            class="max-w-full max-h-full object-contain rounded-lg shadow-lg"
          />
        </div>
      );
    }
    return (
      <div class="w-full h-full overflow-hidden">
        <iframe
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
  return (
    <div class="flex flex-col items-center justify-center h-full gap-3 text-[var(--color-text-muted)] px-6 text-center">
      <p class="text-sm">{t("canvas.noContent")}</p>
      <p class="text-xs opacity-70">{t("canvas.noContentHint")}</p>
    </div>
  );
}

// Track mobile state (module-level so it stays in sync even when component unmounted)
const isMobile = signal(typeof window !== "undefined" && window.innerWidth < LG_BREAKPOINT);

// Keep mobile state in sync with window size
if (typeof window !== "undefined") {
  window.addEventListener("resize", () => {
    isMobile.value = window.innerWidth < LG_BREAKPOINT;
  });
}

// Threshold for dismissing bottom sheet (pixels)
const DISMISS_THRESHOLD = 100;

export function CanvasPanel() {
  const { handleDragStart, handleResizeStart, handleDockedResizeStart } = usePanelInteraction();

  // Mobile bottom sheet drag state
  const [sheetOffset, setSheetOffset] = useState(0);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const touchStartY = useRef(0);

  // Auto-open when canvas becomes visible
  useEffect(() => {
    return canvasVisible.subscribe(syncOpenState);
  }, []);

  // Handle keyboard shortcuts (desktop only)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && canvasPanelOpen.value) {
        canvasPanelOpen.value = false;
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "c") {
        e.preventDefault();
        canvasPanelOpen.value = !canvasPanelOpen.value;
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const url = canvasUrl.value;
  const content = canvasContent.value;

  if (!canvasPanelOpen.value) return null;

  // Mobile bottom sheet touch handlers
  const handleSheetTouchStart = (e: TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    setIsDraggingSheet(true);
  };

  const handleSheetTouchMove = (e: TouchEvent) => {
    if (!isDraggingSheet) return;
    const deltaY = e.touches[0].clientY - touchStartY.current;
    // Only allow dragging down (positive delta)
    setSheetOffset(Math.max(0, deltaY));
  };

  const handleSheetTouchEnd = () => {
    setIsDraggingSheet(false);
    if (sheetOffset > DISMISS_THRESHOLD) {
      // Dismiss
      canvasPanelOpen.value = false;
    }
    // Reset offset (with or without dismiss, the animation handles it)
    setSheetOffset(0);
  };

  // Mobile: bottom sheet
  if (isMobile.value) {
    return (
      <div
        class={`fixed inset-x-0 bottom-0 z-50 bg-[var(--color-bg-surface)] rounded-t-2xl border-t border-[var(--color-border)] shadow-soft-xl flex flex-col ${isDraggingSheet ? "" : "transition-transform duration-200"}`}
        style={{
          height: "70vh",
          maxHeight: "70vh",
          transform: `translateY(${sheetOffset}px)`,
        }}
      >
        {/* Drag handle area */}
        <div
          class="flex flex-col items-center pt-2 pb-1 cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={handleSheetTouchStart}
          onTouchMove={handleSheetTouchMove}
          onTouchEnd={handleSheetTouchEnd}
        >
          <div class="w-10 h-1 bg-[var(--color-border)] rounded-full" />
        </div>

        {/* Header */}
        <div class="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border)]">
          <span class="text-sm font-medium text-[var(--color-text-primary)]">
            {t("canvas.title")}
          </span>
          <div class="flex items-center gap-1">
            {url && (
              <IconButton
                icon={<ExternalLink />}
                label={t("canvas.openUrlInNewTab")}
                size="sm"
                onClick={() => window.open(url, "_blank")}
              />
            )}
            <IconButton
              icon={<X />}
              label={t("canvas.close")}
              size="sm"
              onClick={() => (canvasPanelOpen.value = false)}
            />
          </div>
        </div>

        {/* Content */}
        <div class="flex-1 overflow-hidden">{renderCanvasContent(url, content)}</div>
      </div>
    );
  }

  // Desktop: floating/dockable panel

  return (
    <div
      class={`
        fixed z-50
        bg-[var(--color-bg-surface)]
        shadow-soft-xl
        flex flex-col
        overflow-hidden
        animate-[fade-in-scale_150ms_ease-out]
        ${isMinimized.value ? "rounded-full border-0" : "rounded-xl border border-[var(--color-border)]"}
      `}
      style={{
        ...panelStyle.value,
        position: "fixed",
      }}
    >
      {/* Header - draggable */}
      <div
        class={`
          flex items-center gap-2 px-3 cursor-grab active:cursor-grabbing select-none shrink-0
          ${isMinimized.value ? "py-2" : "py-2 border-b border-[var(--color-border)]"}
        `}
        style={{ height: `${HEADER_HEIGHT}px` }}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        <GripHorizontal class="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
        <span class="text-sm font-medium text-[var(--color-text-primary)] truncate flex-1">
          {t("canvas.title")}
        </span>
        <div class="flex items-center gap-1">
          {url && !isMinimized.value && (
            <IconButton
              icon={<ExternalLink />}
              label={t("canvas.openUrlInNewTab")}
              size="sm"
              onClick={() => window.open(url, "_blank")}
            />
          )}
          {!isMinimized.value && (
            <IconButton
              icon={<PictureInPicture2 />}
              label={t("canvas.openCanvasTab")}
              size="sm"
              onClick={() => {
                window.open("/canvas", "_blank");
                canvasPanelOpen.value = false;
              }}
            />
          )}
          <IconButton
            icon={isMinimized.value ? <Maximize2 /> : <Minimize2 />}
            label={isMinimized.value ? t("canvas.maximize") : t("canvas.minimize")}
            size="sm"
            onClick={() => {
              if (!isMinimized.value) {
                priorDockPosition.value = dockPosition.value;
                if (dockPosition.value !== "floating") {
                  panelX.value = window.innerWidth - 220;
                  panelY.value = window.innerHeight - 60;
                }
                dockPosition.value = "floating";
              } else {
                dockPosition.value = priorDockPosition.value;
              }
              isMinimized.value = !isMinimized.value;
            }}
          />
          <IconButton
            icon={<X />}
            label={t("canvas.close")}
            size="sm"
            onClick={() => (canvasPanelOpen.value = false)}
          />
        </div>
      </div>

      {/* Content */}
      {!isMinimized.value && (
        <div class="flex-1 overflow-hidden relative">
          {renderCanvasContent(url, content)}
          {isInteracting.value && <div class="absolute inset-0 z-10" />}
        </div>
      )}

      {/* Resize handles (floating mode only) */}
      {dockPosition.value === "floating" && !isMinimized.value && (
        <>
          {/* Corners */}
          <div
            class="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10 touch-none"
            onMouseDown={(e) => handleResizeStart(e, "se")}
            onTouchStart={(e) => handleResizeStart(e, "se")}
          />
          <div
            class="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize z-10 touch-none"
            onMouseDown={(e) => handleResizeStart(e, "sw")}
            onTouchStart={(e) => handleResizeStart(e, "sw")}
          />
          <div
            class="absolute top-11 right-0 w-4 h-4 cursor-ne-resize z-10 touch-none"
            onMouseDown={(e) => handleResizeStart(e, "ne")}
            onTouchStart={(e) => handleResizeStart(e, "ne")}
          />
          <div
            class="absolute top-11 left-0 w-4 h-4 cursor-nw-resize z-10 touch-none"
            onMouseDown={(e) => handleResizeStart(e, "nw")}
            onTouchStart={(e) => handleResizeStart(e, "nw")}
          />
          {/* Edges */}
          <div
            class="absolute right-0 w-2 cursor-e-resize touch-none"
            style={{ top: "60px", height: "calc(100% - 76px)" }}
            onMouseDown={(e) => handleResizeStart(e, "e")}
            onTouchStart={(e) => handleResizeStart(e, "e")}
          />
          <div
            class="absolute left-0 w-2 cursor-w-resize touch-none"
            style={{ top: "60px", height: "calc(100% - 76px)" }}
            onMouseDown={(e) => handleResizeStart(e, "w")}
            onTouchStart={(e) => handleResizeStart(e, "w")}
          />
          <div
            class="absolute bottom-0 h-2 cursor-s-resize touch-none"
            style={{ left: "16px", width: "calc(100% - 32px)" }}
            onMouseDown={(e) => handleResizeStart(e, "s")}
            onTouchStart={(e) => handleResizeStart(e, "s")}
          />
        </>
      )}

      {/* Docked resize handles - invisible, just cursor change */}
      {dockPosition.value === "left" && !isMinimized.value && (
        <div
          class="absolute right-0 top-0 w-2 h-full cursor-e-resize"
          onMouseDown={handleDockedResizeStart}
        />
      )}
      {dockPosition.value === "right" && !isMinimized.value && (
        <div
          class="absolute left-0 top-0 w-2 h-full cursor-w-resize"
          onMouseDown={handleDockedResizeStart}
        />
      )}
      {dockPosition.value === "top" && !isMinimized.value && (
        <div
          class="absolute left-0 bottom-0 w-full h-2 cursor-s-resize"
          onMouseDown={handleDockedResizeStart}
        />
      )}
    </div>
  );
}
