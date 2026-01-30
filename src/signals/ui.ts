/**
 * UI Signals
 *
 * Transient UI state (not persisted).
 *
 * @see Phase 0.9 in ROADMAP.md for full spec
 */

import { signal } from "@preact/signals";

export type View = "chat" | "cron" | "config" | "status";

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "warning" | "info";
  duration?: number;
}

/** Whether the sidebar is open */
export const sidebarOpen = signal<boolean>(true);

/** Currently active main view */
export const activeView = signal<View>("chat");

/** Currently open modal (null if none) */
export const activeModal = signal<string | null>(null);

/** Toast notification queue */
export const toasts = signal<Toast[]>([]);
