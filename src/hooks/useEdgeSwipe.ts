/**
 * useEdgeSwipe
 *
 * Detects edge swipe gestures for mobile navigation.
 * Swipe from left edge → open sidebar
 * Swipe left on open sidebar → close sidebar
 */

import { useEffect, useRef } from "preact/hooks";
import { sidebarOpen, LG_BREAKPOINT } from "@/signals/ui";

/** How close to the edge the touch must start (px) */
const EDGE_THRESHOLD = 30;

/** Minimum swipe distance to trigger (px) */
const SWIPE_THRESHOLD = 50;

/** Maximum vertical movement allowed (px) - prevents triggering on scroll */
const MAX_VERTICAL = 75;

export function useEdgeSwipe() {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const touchStartedAtEdge = useRef(false);

  useEffect(() => {
    // Only enable on mobile
    const isMobile = () => window.innerWidth < LG_BREAKPOINT;

    const handleTouchStart = (e: TouchEvent) => {
      if (!isMobile()) return;

      const touch = e.touches[0];
      touchStart.current = { x: touch.clientX, y: touch.clientY };

      // Check if touch started at left edge (for opening)
      // Or anywhere if sidebar is open (for closing)
      touchStartedAtEdge.current = touch.clientX <= EDGE_THRESHOLD || sidebarOpen.value;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isMobile() || !touchStart.current || !touchStartedAtEdge.current) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStart.current.x;
      const deltaY = Math.abs(touch.clientY - touchStart.current.y);

      // Ignore if too much vertical movement (user is scrolling)
      if (deltaY > MAX_VERTICAL) {
        touchStart.current = null;
        return;
      }

      // Swipe right from left edge → open
      if (
        !sidebarOpen.value &&
        touchStart.current.x <= EDGE_THRESHOLD &&
        deltaX > SWIPE_THRESHOLD
      ) {
        sidebarOpen.value = true;
        touchStart.current = null;
      }

      // Swipe left when open → close
      if (sidebarOpen.value && deltaX < -SWIPE_THRESHOLD) {
        sidebarOpen.value = false;
        touchStart.current = null;
      }
    };

    const handleTouchEnd = () => {
      touchStart.current = null;
      touchStartedAtEdge.current = false;
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);
}
