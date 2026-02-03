/**
 * ResizeHandle
 *
 * A draggable handle for resizing panels.
 */

import { useCallback, useRef, useEffect } from "preact/hooks";

export interface ResizeHandleProps {
  /** Direction of resize */
  direction: "horizontal" | "vertical";

  /** Called when drag starts */
  onResizeStart?: () => void;

  /** Called during drag with delta in pixels */
  onResize: (delta: number) => void;

  /** Called when drag ends */
  onResizeEnd?: () => void;

  /** Additional class names */
  class?: string;
}

export function ResizeHandle({
  direction,
  onResizeStart,
  onResize,
  onResizeEnd,
  class: className = "",
}: ResizeHandleProps) {
  const startPosRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  // Store handlers in refs for cleanup on unmount
  const handlersRef = useRef<{
    move: ((e: MouseEvent) => void) | null;
    up: (() => void) | null;
  }>({ move: null, up: null });

  // Cleanup on unmount - remove any lingering event listeners
  useEffect(() => {
    return () => {
      if (handlersRef.current.move) {
        document.removeEventListener("mousemove", handlersRef.current.move);
      }
      if (handlersRef.current.up) {
        document.removeEventListener("mouseup", handlersRef.current.up);
      }
      // Reset cursor/selection if dragging when unmounted
      if (isDraggingRef.current) {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
  }, []);

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      startPosRef.current = direction === "horizontal" ? e.clientX : e.clientY;

      onResizeStart?.();

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDraggingRef.current) return;

        const currentPos = direction === "horizontal" ? moveEvent.clientX : moveEvent.clientY;
        const delta = currentPos - startPosRef.current;
        startPosRef.current = currentPos;

        onResize(delta);
      };

      const handleMouseUp = () => {
        isDraggingRef.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        // Clear refs since listeners are removed
        handlersRef.current.move = null;
        handlersRef.current.up = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";

        onResizeEnd?.();
      };

      // Store handlers in ref for cleanup
      handlersRef.current.move = handleMouseMove;
      handlersRef.current.up = handleMouseUp;

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = direction === "horizontal" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
    },
    [direction, onResize, onResizeStart, onResizeEnd],
  );

  const isHorizontal = direction === "horizontal";

  return (
    <div
      onMouseDown={handleMouseDown}
      class={`
        ${isHorizontal ? "w-1 cursor-col-resize hover:w-1.5" : "h-1 cursor-row-resize hover:h-1.5"}
        bg-transparent hover:bg-[var(--color-accent)]/30 active:bg-[var(--color-accent)]/50
        transition-all duration-150 ease-out
        flex-shrink-0
        ${className}
      `}
      role="separator"
      aria-orientation={isHorizontal ? "horizontal" : "vertical"}
      aria-label="Resize handle"
    />
  );
}
