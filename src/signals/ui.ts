/**
 * UI Signals
 *
 * Transient UI state (sidebar, modals, etc.).
 */

import { signal, effect } from "@preact/signals";
import { getSidebarWidth, setSidebarWidth } from "@/lib/storage";

// ============================================
// Sidebar
// ============================================

export const SIDEBAR_MIN_WIDTH = 200;
export const SIDEBAR_MAX_WIDTH = 480;

/** Sidebar width on mobile (w-72 = 18rem = 288px) */
export const SIDEBAR_WIDTH_MOBILE = 288;

/** Tailwind lg breakpoint (1024px) */
export const LG_BREAKPOINT = 1024;

/** Whether the sidebar is open (start closed on mobile) */
const isMobile = typeof window !== "undefined" && window.innerWidth < LG_BREAKPOINT;
export const sidebarOpen = signal<boolean>(!isMobile);

/** Close sidebar on mobile (< lg breakpoint) - use after navigation */
export function closeSidebarOnMobile() {
  if (window.innerWidth < LG_BREAKPOINT) {
    sidebarOpen.value = false;
  }
}

/** Sidebar width in pixels */
export const sidebarWidth = signal<number>(getSidebarWidth());

/** Whether the sidebar is currently being resized */
export const sidebarResizing = signal<boolean>(false);

// Persist sidebar width to storage
effect(() => {
  setSidebarWidth(sidebarWidth.value);
});

// ============================================
// Navigation
// ============================================

/** Previous route (for "back" navigation from settings) */
export const previousRoute = signal<string>("/");

// ============================================
// Modals
// ============================================

/** Whether the new chat modal is open */
export const showNewChatModal = signal<boolean>(false);

// ============================================
// Canvas Panel
// ============================================

/** Whether the canvas panel is open */
export const canvasPanelOpen = signal<boolean>(false);
