/**
 * useEdgeSwipe
 *
 * Detects edge swipe gestures for mobile navigation.
 * Sidebar follows finger during drag, then snaps open/closed on release.
 */

import { useEffect } from "preact/hooks";
import { signal } from "@preact/signals";
import { sidebarOpen, LG_BREAKPOINT } from "@/signals/ui";

/** Edge zone start - avoid Safari's back gesture at 0-20px */
const EDGE_START = 20;
/** Edge zone end */
const EDGE_END = 50;
/** Sidebar width on mobile */
const SIDEBAR_WIDTH = 288; // w-72 = 18rem = 288px
/** Minimum drag to trigger open/close on release */
const SNAP_THRESHOLD = SIDEBAR_WIDTH * 0.3;
/** Maximum vertical movement allowed (px) */
const MAX_VERTICAL = 75;

/** Current drag offset (0 = closed, SIDEBAR_WIDTH = open) */
export const sidebarDragOffset = signal<number | null>(null);

/** Whether we're actively dragging */
export const isDraggingSidebar = signal(false);

export function useEdgeSwipe() {
  useEffect(() => {
    const isMobile = () => window.innerWidth < LG_BREAKPOINT;

    let touchStartX = 0;
    let touchStartY = 0;
    let startedInEdgeZone = false;
    let startedWithOpen = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (!isMobile()) return;

      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;

      // Check if touch started in edge zone (for opening) or sidebar is open (for closing)
      const inEdgeZone = touch.clientX >= EDGE_START && touch.clientX <= EDGE_END;
      startedInEdgeZone = inEdgeZone;
      startedWithOpen = sidebarOpen.value;

      if (inEdgeZone || startedWithOpen) {
        // Initialize drag offset based on current state
        sidebarDragOffset.value = startedWithOpen ? SIDEBAR_WIDTH : 0;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isMobile()) return;
      if (!startedInEdgeZone && !startedWithOpen) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = Math.abs(touch.clientY - touchStartY);

      // Ignore if too much vertical movement (user is scrolling)
      if (deltaY > MAX_VERTICAL) {
        sidebarDragOffset.value = null;
        isDraggingSidebar.value = false;
        return;
      }

      isDraggingSidebar.value = true;

      // Calculate new offset
      let newOffset: number;
      if (startedWithOpen) {
        // Dragging from open state
        newOffset = SIDEBAR_WIDTH + deltaX;
      } else {
        // Dragging from closed state
        newOffset = deltaX;
      }

      // Clamp to valid range
      newOffset = Math.max(0, Math.min(SIDEBAR_WIDTH, newOffset));
      sidebarDragOffset.value = newOffset;
    };

    const handleTouchEnd = () => {
      if (!isDraggingSidebar.value) {
        sidebarDragOffset.value = null;
        startedInEdgeZone = false;
        startedWithOpen = false;
        return;
      }

      const offset = sidebarDragOffset.value ?? 0;

      // Determine whether to open or close based on position
      if (startedWithOpen) {
        // Started open: close if dragged past threshold
        sidebarOpen.value = offset > SIDEBAR_WIDTH - SNAP_THRESHOLD;
      } else {
        // Started closed: open if dragged past threshold
        sidebarOpen.value = offset > SNAP_THRESHOLD;
      }

      // Reset drag state
      sidebarDragOffset.value = null;
      isDraggingSidebar.value = false;
      startedInEdgeZone = false;
      startedWithOpen = false;
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    document.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, []);
}
