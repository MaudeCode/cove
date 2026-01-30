/**
 * ResizeHandle
 *
 * A draggable handle for resizing panels.
 */

import { useCallback, useRef } from "preact/hooks";

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
        document.body.style.cursor = "";
        document.body.style.userSelect = "";

        onResizeEnd?.();
      };

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
      aria-orientation={isHorizontal ? "vertical" : "horizontal"}
      aria-label="Resize handle"
    />
  );
}
