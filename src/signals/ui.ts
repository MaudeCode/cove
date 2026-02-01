/**
 * UI Signals
 *
 * Transient UI state (not persisted).
 *
 * @see Phase 0.9 in ROADMAP.md for full spec
 */

import { signal, effect } from "@preact/signals";

// ============================================
// Sidebar
// ============================================

/** Default sidebar width in pixels */
const SIDEBAR_DEFAULT_WIDTH = 256;
export const SIDEBAR_MIN_WIDTH = 200;
export const SIDEBAR_MAX_WIDTH = 480;

/** Load saved sidebar width from localStorage */
function loadSidebarWidth(): number {
  try {
    const saved = localStorage.getItem("cove:sidebarWidth");
    if (saved) {
      const width = parseInt(saved, 10);
      if (!isNaN(width) && width >= SIDEBAR_MIN_WIDTH && width <= SIDEBAR_MAX_WIDTH) {
        return width;
      }
    }
  } catch {
    // Ignore localStorage errors
  }
  return SIDEBAR_DEFAULT_WIDTH;
}

/** Whether the sidebar is open */
export const sidebarOpen = signal<boolean>(true);

/** Sidebar width in pixels */
export const sidebarWidth = signal<number>(loadSidebarWidth());

/** Whether the sidebar is currently being resized */
export const sidebarResizing = signal<boolean>(false);

// Persist sidebar width to localStorage
effect(() => {
  try {
    localStorage.setItem("cove:sidebarWidth", String(sidebarWidth.value));
  } catch {
    // Ignore localStorage errors
  }
});

// Note: Toast handling moved to @/components/ui/Toast.tsx
