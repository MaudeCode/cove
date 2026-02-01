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

/** Whether the sidebar is open */
export const sidebarOpen = signal<boolean>(true);

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
