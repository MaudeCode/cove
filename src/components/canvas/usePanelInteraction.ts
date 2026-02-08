/**
 * Panel Interaction Hook
 *
 * Handles drag-to-dock and resize behavior for the canvas panel.
 */

import { useRef, useCallback, useEffect } from "preact/hooks";
import {
  dockPosition,
  panelX,
  panelY,
  panelWidth,
  panelHeight,
  isMinimized,
  isInteracting,
  getPointerCoords,
  MIN_WIDTH,
  MIN_HEIGHT,
  MAX_DOCKED_WIDTH_PERCENT,
  MAX_DOCKED_HEIGHT_PERCENT,
  DOCK_THRESHOLD,
  HEADER_HEIGHT,
} from "./canvas-panel-state";

export function usePanelInteraction() {
  const isDragging = useRef(false);
  const isResizing = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, panelX: 0, panelY: 0 });
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0, panelX: 0, panelY: 0 });
  const resizeDirection = useRef<string>("");

  // Drag handling (mouse + touch)
  const handleDragStart = useCallback((e: MouseEvent | TouchEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    isDragging.current = true;
    isInteracting.value = true;

    const coords = getPointerCoords(e);
    dragStart.current = {
      x: coords.x,
      y: coords.y,
      panelX: panelX.value,
      panelY: panelY.value,
    };

    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
  }, []);

  // Resize handling for floating panel (mouse + touch)
  const handleResizeStart = useCallback((e: MouseEvent | TouchEvent, direction: string) => {
    e.preventDefault();
    if ("stopPropagation" in e) e.stopPropagation();
    isResizing.current = true;
    isInteracting.value = true;
    resizeDirection.current = direction;
    const coords = getPointerCoords(e);
    resizeStart.current = {
      x: coords.x,
      y: coords.y,
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

  // Main mouse/touch move and up handlers
  useEffect(() => {
    const handlePointerMove = (clientX: number, clientY: number) => {
      if (isDragging.current) {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // When minimized, don't allow docking - just free drag
        if (isMinimized.value) {
          const dx = clientX - dragStart.current.x;
          const dy = clientY - dragStart.current.y;
          const newX = dragStart.current.panelX + dx;
          const newY = dragStart.current.panelY + dy;
          const minWidth = 200;
          panelX.value = Math.max(0, Math.min(newX, viewportWidth - minWidth));
          panelY.value = Math.max(0, Math.min(newY, viewportHeight - HEADER_HEIGHT));
          return;
        }

        // Check for dock zones
        if (clientX < DOCK_THRESHOLD) {
          dockPosition.value = "left";
        } else if (clientX > viewportWidth - DOCK_THRESHOLD) {
          dockPosition.value = "right";
        } else if (clientY < DOCK_THRESHOLD) {
          dockPosition.value = "top";
        } else {
          if (dockPosition.value !== "floating") {
            panelX.value = Math.max(
              0,
              Math.min(clientX - panelWidth.value / 2, viewportWidth - panelWidth.value),
            );
            panelY.value = Math.max(
              0,
              Math.min(clientY - HEADER_HEIGHT / 2, viewportHeight - panelHeight.value),
            );
            dragStart.current = {
              x: clientX,
              y: clientY,
              panelX: panelX.value,
              panelY: panelY.value,
            };
          } else {
            const dx = clientX - dragStart.current.x;
            const dy = clientY - dragStart.current.y;
            const newX = dragStart.current.panelX + dx;
            const newY = dragStart.current.panelY + dy;
            panelX.value = Math.max(0, Math.min(newX, viewportWidth - panelWidth.value));
            panelY.value = Math.max(0, Math.min(newY, viewportHeight - panelHeight.value));
          }
          dockPosition.value = "floating";
        }
      }

      if (isResizing.current && dockPosition.value === "floating") {
        const dir = resizeDirection.current;
        const { x: startX, y: startY, width: startW, height: startH } = resizeStart.current;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let newWidth = startW;
        let newHeight = startH;
        let newX = resizeStart.current.panelX;
        let newY = resizeStart.current.panelY;

        if (dir.includes("e")) {
          newWidth = Math.max(MIN_WIDTH, startW + (clientX - startX));
        }
        if (dir.includes("w")) {
          const dx = startX - clientX;
          const possibleWidth = startW + dx;
          if (possibleWidth >= MIN_WIDTH) {
            newWidth = possibleWidth;
            newX = resizeStart.current.panelX - dx;
          }
        }
        if (dir.includes("s")) {
          newHeight = Math.max(MIN_HEIGHT, startH + (clientY - startY));
        }
        if (dir.includes("n")) {
          const dy = startY - clientY;
          const possibleHeight = startH + dy;
          if (possibleHeight >= MIN_HEIGHT) {
            newHeight = possibleHeight;
            newY = resizeStart.current.panelY - dy;
          }
        }

        // Clamp to viewport
        if (newX + newWidth > viewportWidth) {
          newWidth = viewportWidth - newX;
        }
        if (newY + newHeight > viewportHeight) {
          newHeight = viewportHeight - newY;
        }
        if (newX < 0) {
          newWidth += newX;
          newX = 0;
        }
        if (newY < 0) {
          newHeight += newY;
          newY = 0;
        }

        panelWidth.value = Math.max(MIN_WIDTH, newWidth);
        panelHeight.value = Math.max(MIN_HEIGHT, newHeight);
        panelX.value = Math.max(0, newX);
        panelY.value = Math.max(0, newY);
      }
    };

    const handlePointerUp = () => {
      if (isDragging.current || isResizing.current) {
        isDragging.current = false;
        isResizing.current = false;
        isInteracting.value = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };

    const handleMouseMove = (e: MouseEvent) => handlePointerMove(e.clientX, e.clientY);
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        handlePointerMove(touch.clientX, touch.clientY);
      }
    };
    const handleMouseUp = () => handlePointerUp();
    const handleTouchEnd = () => handlePointerUp();

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  return {
    handleDragStart,
    handleResizeStart,
    handleDockedResizeStart,
  };
}
