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
  pendingCanvasEval,
  pendingCanvasSnapshot,
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
import { CanvasContent } from "./CanvasContent";
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
type IframeEvalWindow = Window & { eval(code: string): unknown };

export function CanvasPanel() {
  const { handleDragStart, handleResizeStart, handleDockedResizeStart } = usePanelInteraction();

  // Mobile bottom sheet drag state
  const [sheetOffset, setSheetOffset] = useState(0);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const touchStartY = useRef(0);

  // Ref for iframe/img element for eval/snapshot
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Auto-open when canvas becomes visible
  useEffect(() => {
    return canvasVisible.subscribe(syncOpenState);
  }, []);

  // Handle canvas.eval requests
  useEffect(() => {
    return pendingCanvasEval.subscribe((pending) => {
      if (!pending) return;

      const { js, resolve, reject } = pending;
      pendingCanvasEval.value = null;

      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) {
        reject("No iframe available for eval");
        return;
      }

      try {
        // Execute JS in iframe context
        const result: unknown = (iframe.contentWindow as IframeEvalWindow).eval(js);
        resolve(result);
      } catch (e) {
        reject(String(e));
      }
    });
  }, []);

  // Handle canvas.snapshot requests
  useEffect(() => {
    return pendingCanvasSnapshot.subscribe((pending) => {
      if (!pending) return;

      const { maxWidth, quality, outputFormat, resolve, reject } = pending;
      pendingCanvasSnapshot.value = null;

      try {
        // Try image first
        const img = imgRef.current;

        if (img && img.complete) {
          const canvas = document.createElement("canvas");
          let width = img.naturalWidth || img.width || 100;
          let height = img.naturalHeight || img.height || 100;
          if (width > maxWidth || height > maxWidth) {
            const scale = maxWidth / Math.max(width, height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const mimeType = outputFormat === "png" ? "image/png" : "image/jpeg";
            const dataUrl = canvas.toDataURL(mimeType, quality);
            resolve(dataUrl);
            return;
          }
        }

        // Try iframe
        const iframe = iframeRef.current;
        if (!iframe?.contentWindow) {
          reject("No canvas content available for snapshot (no img or iframe ref)");
          return;
        }

        // For same-origin iframes, we can capture the document
        const doc = iframe.contentDocument;
        if (!doc) {
          reject("Cannot access iframe document (cross-origin?)");
          return;
        }

        // For HTML content, just return a placeholder for now
        // Full HTML-to-canvas is complex and requires libraries like html2canvas
        reject("HTML snapshot not yet implemented - use images for now");
      } catch (e) {
        reject(`Snapshot failed: ${e}`);
      }
    });
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

  // Read all canvas signals in component body to create subscriptions
  const url = canvasUrl.value;
  const blobUrl = canvasBlobUrl.value;
  const contentType = canvasContentType.value;
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
            {t("common.canvas")}
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
        <div class="flex-1 overflow-hidden">
          <CanvasContent
            url={url}
            blobUrl={blobUrl}
            contentType={contentType}
            content={content}
            iframeRef={iframeRef}
            imgRef={imgRef}
          />
        </div>
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
        role="toolbar"
        aria-label="Canvas panel controls"
        style={{ height: `${HEADER_HEIGHT}px` }}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        <GripHorizontal class="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
        <span class="text-sm font-medium text-[var(--color-text-primary)] truncate flex-1">
          {t("common.canvas")}
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
          <CanvasContent
            url={url}
            blobUrl={blobUrl}
            contentType={contentType}
            content={content}
            iframeRef={iframeRef}
            imgRef={imgRef}
          />
          {isInteracting.value && <div class="absolute inset-0 z-10" />}
        </div>
      )}

      {/* Resize handles (floating mode only) */}
      {dockPosition.value === "floating" && !isMinimized.value && (
        <>
          {/* Corners - aria-hidden as they duplicate edge functionality */}
          <div
            class="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10 touch-none"
            aria-hidden="true"
            onMouseDown={(e) => handleResizeStart(e, "se")}
            onTouchStart={(e) => handleResizeStart(e, "se")}
          />
          <div
            class="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize z-10 touch-none"
            aria-hidden="true"
            onMouseDown={(e) => handleResizeStart(e, "sw")}
            onTouchStart={(e) => handleResizeStart(e, "sw")}
          />
          <div
            class="absolute top-11 right-0 w-4 h-4 cursor-ne-resize z-10 touch-none"
            aria-hidden="true"
            onMouseDown={(e) => handleResizeStart(e, "ne")}
            onTouchStart={(e) => handleResizeStart(e, "ne")}
          />
          <div
            class="absolute top-11 left-0 w-4 h-4 cursor-nw-resize z-10 touch-none"
            aria-hidden="true"
            onMouseDown={(e) => handleResizeStart(e, "nw")}
            onTouchStart={(e) => handleResizeStart(e, "nw")}
          />
          {/* Edges */}
          <div
            class="absolute right-0 w-2 cursor-e-resize touch-none"
            role="separator"
            aria-orientation="vertical"
            style={{ top: "60px", height: "calc(100% - 76px)" }}
            onMouseDown={(e) => handleResizeStart(e, "e")}
            onTouchStart={(e) => handleResizeStart(e, "e")}
          />
          <div
            class="absolute left-0 w-2 cursor-w-resize touch-none"
            role="separator"
            aria-orientation="vertical"
            style={{ top: "60px", height: "calc(100% - 76px)" }}
            onMouseDown={(e) => handleResizeStart(e, "w")}
            onTouchStart={(e) => handleResizeStart(e, "w")}
          />
          <div
            class="absolute bottom-0 h-2 cursor-s-resize touch-none"
            role="separator"
            aria-orientation="horizontal"
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
          role="separator"
          aria-orientation="vertical"
          onMouseDown={handleDockedResizeStart}
        />
      )}
      {dockPosition.value === "right" && !isMinimized.value && (
        <div
          class="absolute left-0 top-0 w-2 h-full cursor-w-resize"
          role="separator"
          aria-orientation="vertical"
          onMouseDown={handleDockedResizeStart}
        />
      )}
      {dockPosition.value === "top" && !isMinimized.value && (
        <div
          class="absolute left-0 bottom-0 w-full h-2 cursor-s-resize"
          role="separator"
          aria-orientation="horizontal"
          onMouseDown={handleDockedResizeStart}
        />
      )}
    </div>
  );
}
