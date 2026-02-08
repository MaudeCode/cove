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
} from "@/lib/node-connection";
import { canvasPanelOpen } from "@/signals/ui";
import { X, ExternalLink, GripHorizontal, Minimize2, Maximize2 } from "lucide-preact";
import { signal, computed } from "@preact/signals";
import { useEffect, useRef, useCallback } from "preact/hooks";
import { IconButton } from "@/components/ui/IconButton";
import { t } from "@/lib/i18n";

// Panel state
type DockPosition = "floating" | "left" | "top" | "right";

const dockPosition = signal<DockPosition>("floating");
const panelX = signal(100);
const panelY = signal(100);
const panelWidth = signal(400);
const panelHeight = signal(350);
const isMinimized = signal(false);

// Constraints
const MIN_WIDTH = 280;
const MIN_HEIGHT = 200;
const MAX_DOCKED_WIDTH_PERCENT = 0.5;
const MAX_DOCKED_HEIGHT_PERCENT = 0.6;
const DOCK_THRESHOLD = 40; // pixels from edge to trigger dock
const HEADER_HEIGHT = 44;

// Computed panel style based on dock position
const panelStyle = computed(() => {
  if (isMinimized.value) {
    return {
      width: "auto",
      height: `${HEADER_HEIGHT}px`,
      left: `${panelX.value}px`,
      top: `${panelY.value}px`,
      borderRadius: "9999px",
    };
  }

  switch (dockPosition.value) {
    case "left":
      return {
        left: "0",
        top: "0",
        width: `${panelWidth.value}px`,
        height: "100%",
        borderRadius: "0 12px 12px 0",
      };
    case "right":
      return {
        right: "0",
        top: "0",
        width: `${panelWidth.value}px`,
        height: "100%",
        borderRadius: "12px 0 0 12px",
      };
    case "top":
      return {
        left: "0",
        top: "0",
        width: "100%",
        height: `${panelHeight.value}px`,
        borderRadius: "0 0 12px 12px",
      };
    default:
      return {
        left: `${panelX.value}px`,
        top: `${panelY.value}px`,
        width: `${panelWidth.value}px`,
        height: `${panelHeight.value}px`,
        borderRadius: "12px",
      };
  }
});

// Sync panel visibility with canvas state
function syncOpenState() {
  if (canvasVisible.value && !canvasPanelOpen.value) {
    // Auto-open when content arrives
    canvasPanelOpen.value = true;
    isMinimized.value = false;
  } else if (!canvasVisible.value && canvasPanelOpen.value) {
    // Auto-close when agent hides canvas
    canvasPanelOpen.value = false;
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
          class="w-full h-full border-0 bg-white"
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
          class="w-full h-full border-0 bg-white"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          title={t("canvas.iframeTitle")}
        />
      </div>
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
      <p class="text-xs opacity-70">{t("canvas.noContentHint")}</p>
    </div>
  );
}

// Track if actively interacting (for overlay to block iframe)
const isInteracting = signal(false);

export function CanvasPanel() {
  const isDragging = useRef(false);
  const isResizing = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, panelX: 0, panelY: 0 });
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0, panelX: 0, panelY: 0 });
  const resizeDirection = useRef<string>("");

  // Auto-open when canvas becomes visible
  useEffect(() => {
    return canvasVisible.subscribe(syncOpenState);
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && canvasPanelOpen.value) {
        canvasPanelOpen.value = false;
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Drag handling
  const handleDragStart = useCallback((e: MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    isDragging.current = true;
    isInteracting.value = true;

    // Store mouse position relative to panel for accurate undocking
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      panelX: panelX.value,
      panelY: panelY.value,
    };

    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
  }, []);

  // Resize handling for floating panel
  const handleResizeStart = useCallback((e: MouseEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing.current = true;
    isInteracting.value = true;
    resizeDirection.current = direction;
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      width: panelWidth.value,
      height: panelHeight.value,
      panelX: panelX.value,
      panelY: panelY.value,
    };
    const cursorMap: Record<string, string> = {
      n: "n-resize",
      s: "s-resize",
      e: "e-resize",
      w: "w-resize",
      ne: "ne-resize",
      nw: "nw-resize",
      se: "se-resize",
      sw: "sw-resize",
    };
    document.body.style.cursor = cursorMap[direction] || "nwse-resize";
    document.body.style.userSelect = "none";
  }, []);

  // Resize handling for docked panels
  const handleDockedResizeStart = useCallback((e: MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    isInteracting.value = true;
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      width: panelWidth.value,
      height: panelHeight.value,
      panelX: panelX.value,
      panelY: panelY.value,
    };
    document.body.style.userSelect = "none";

    const maxWidth = window.innerWidth * MAX_DOCKED_WIDTH_PERCENT;
    const maxHeight = window.innerHeight * MAX_DOCKED_HEIGHT_PERCENT;

    const handleMove = (ev: MouseEvent) => {
      if (dockPosition.value === "left") {
        const dx = ev.clientX - resizeStart.current.x;
        panelWidth.value = Math.min(maxWidth, Math.max(MIN_WIDTH, resizeStart.current.width + dx));
      } else if (dockPosition.value === "right") {
        const dx = resizeStart.current.x - ev.clientX;
        panelWidth.value = Math.min(maxWidth, Math.max(MIN_WIDTH, resizeStart.current.width + dx));
      } else if (dockPosition.value === "top") {
        const dy = ev.clientY - resizeStart.current.y;
        panelHeight.value = Math.min(
          maxHeight,
          Math.max(MIN_HEIGHT, resizeStart.current.height + dy),
        );
      }
    };

    const handleUp = () => {
      isResizing.current = false;
      isInteracting.value = false;
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // When minimized, don't allow docking - just free drag
        if (isMinimized.value) {
          const dx = e.clientX - dragStart.current.x;
          const dy = e.clientY - dragStart.current.y;
          const newX = dragStart.current.panelX + dx;
          const newY = dragStart.current.panelY + dy;
          // Use minimized dimensions for bounds
          const minWidth = 200;
          panelX.value = Math.max(0, Math.min(newX, viewportWidth - minWidth));
          panelY.value = Math.max(0, Math.min(newY, viewportHeight - HEADER_HEIGHT));
          return;
        }

        // Check for dock zones
        if (e.clientX < DOCK_THRESHOLD) {
          dockPosition.value = "left";
        } else if (e.clientX > viewportWidth - DOCK_THRESHOLD) {
          dockPosition.value = "right";
        } else if (e.clientY < DOCK_THRESHOLD) {
          dockPosition.value = "top";
        } else {
          // Transitioning to floating
          if (dockPosition.value !== "floating") {
            // When undocking, position panel centered on cursor
            panelX.value = Math.max(
              0,
              Math.min(e.clientX - panelWidth.value / 2, viewportWidth - panelWidth.value),
            );
            panelY.value = Math.max(
              0,
              Math.min(e.clientY - HEADER_HEIGHT / 2, viewportHeight - panelHeight.value),
            );
            // Update drag start to current position for smooth dragging
            dragStart.current = {
              x: e.clientX,
              y: e.clientY,
              panelX: panelX.value,
              panelY: panelY.value,
            };
          } else {
            // Normal floating drag
            const dx = e.clientX - dragStart.current.x;
            const dy = e.clientY - dragStart.current.y;
            const newX = dragStart.current.panelX + dx;
            const newY = dragStart.current.panelY + dy;
            panelX.value = Math.max(0, Math.min(newX, viewportWidth - panelWidth.value));
            panelY.value = Math.max(0, Math.min(newY, viewportHeight - panelHeight.value));
          }
          dockPosition.value = "floating";
        }
      }

      if (isResizing.current && dockPosition.value === "floating") {
        const dx = e.clientX - resizeStart.current.x;
        const dy = e.clientY - resizeStart.current.y;
        const dir = resizeDirection.current;

        if (dir.includes("e")) {
          panelWidth.value = Math.max(MIN_WIDTH, resizeStart.current.width + dx);
        }
        if (dir.includes("w")) {
          const newWidth = Math.max(MIN_WIDTH, resizeStart.current.width - dx);
          const widthDelta = resizeStart.current.width - newWidth;
          panelWidth.value = newWidth;
          panelX.value = resizeStart.current.panelX + widthDelta;
        }
        if (dir.includes("s")) {
          panelHeight.value = Math.max(MIN_HEIGHT, resizeStart.current.height + dy);
        }
        if (dir.includes("n")) {
          const newHeight = Math.max(MIN_HEIGHT, resizeStart.current.height - dy);
          const heightDelta = resizeStart.current.height - newHeight;
          panelHeight.value = newHeight;
          panelY.value = resizeStart.current.panelY + heightDelta;
        }
      }
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      isResizing.current = false;
      isInteracting.value = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const url = canvasUrl.value;
  const content = canvasContent.value;

  if (!canvasPanelOpen.value) return null;

  return (
    <div
      class={`
            fixed z-50
            bg-[var(--color-bg-surface)]
            shadow-soft-xl
            flex flex-col
            overflow-hidden
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
              flex items-center gap-2 px-3 h-11
              bg-[var(--color-bg-secondary)]
              cursor-grab active:cursor-grabbing
              select-none flex-shrink-0
              ${isMinimized.value ? "rounded-full" : "border-b border-[var(--color-border)]"}
            `}
        onMouseDown={handleDragStart}
      >
        <GripHorizontal class="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0" />
        <span class="text-sm font-medium text-[var(--color-text)] truncate flex-1">
          {t("canvas.title")}
        </span>
        {url && !isMinimized.value && (
          <span class="text-xs text-[var(--color-text-muted)] truncate hidden sm:block max-w-[100px]">
            {(() => {
              try {
                return new URL(url).hostname;
              } catch {
                return "";
              }
            })()}
          </span>
        )}
        <div class="flex items-center flex-shrink-0">
          {url && !isMinimized.value && (
            <IconButton
              icon={<ExternalLink />}
              label={t("canvas.openInNewTab")}
              size="sm"
              onClick={() => window.open(url, "_blank")}
            />
          )}
          <IconButton
            icon={isMinimized.value ? <Maximize2 /> : <Minimize2 />}
            label={isMinimized.value ? t("canvas.maximize") : t("canvas.minimize")}
            size="sm"
            onClick={() => {
              isMinimized.value = !isMinimized.value;
              if (isMinimized.value) {
                dockPosition.value = "floating";
              }
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
          {/* Overlay to block iframe during drag/resize */}
          {isInteracting.value && <div class="absolute inset-0 z-10" />}
        </div>
      )}

      {/* Resize handles (only when floating and not minimized) */}
      {dockPosition.value === "floating" && !isMinimized.value && (
        <>
          {/* Corners */}
          <div
            class="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10"
            onMouseDown={(e) => handleResizeStart(e, "se")}
          />
          <div
            class="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize z-10"
            onMouseDown={(e) => handleResizeStart(e, "sw")}
          />
          {/* Note: top corners are below header to avoid overlap */}
          <div
            class="absolute top-11 right-0 w-4 h-4 cursor-ne-resize z-10"
            onMouseDown={(e) => handleResizeStart(e, "ne")}
          />
          <div
            class="absolute top-11 left-0 w-4 h-4 cursor-nw-resize z-10"
            onMouseDown={(e) => handleResizeStart(e, "nw")}
          />
          {/* Edges - side edges start below header (44px + 16px for corner) */}
          <div
            class="absolute right-0 w-2 cursor-e-resize"
            style={{ top: "60px", height: "calc(100% - 76px)" }}
            onMouseDown={(e) => handleResizeStart(e, "e")}
          />
          <div
            class="absolute left-0 w-2 cursor-w-resize"
            style={{ top: "60px", height: "calc(100% - 76px)" }}
            onMouseDown={(e) => handleResizeStart(e, "w")}
          />
          <div
            class="absolute bottom-0 h-2 cursor-s-resize"
            style={{ left: "16px", width: "calc(100% - 32px)" }}
            onMouseDown={(e) => handleResizeStart(e, "s")}
          />
        </>
      )}

      {/* Resize handle for docked panels */}
      {dockPosition.value !== "floating" && !isMinimized.value && (
        <div
          class={`
            absolute
            ${dockPosition.value === "left" ? "top-0 right-0 w-2 h-full cursor-e-resize" : ""}
            ${dockPosition.value === "right" ? "top-0 left-0 w-2 h-full cursor-w-resize" : ""}
            ${dockPosition.value === "top" ? "bottom-0 left-0 w-full h-2 cursor-s-resize" : ""}
          `}
          onMouseDown={handleDockedResizeStart}
        />
      )}
    </div>
  );
}
