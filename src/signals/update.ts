/**
 * Update Signals
 *
 * Track gateway update availability.
 */

import { signal } from "@preact/signals";
import { subscribe } from "@/lib/gateway";

// ============================================
// Constants
// ============================================

const STORAGE_KEY = "cove:dismissed-update-version";

// ============================================
// Types
// ============================================

export interface UpdateAvailable {
  currentVersion: string;
  latestVersion: string;
  channel: string;
}

function isUpdateAvailable(value: unknown): value is UpdateAvailable {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<Record<keyof UpdateAvailable, unknown>>;
  return (
    typeof candidate.currentVersion === "string" &&
    typeof candidate.latestVersion === "string" &&
    typeof candidate.channel === "string"
  );
}

// ============================================
// State
// ============================================

/** Available update info, or null if up to date */
export const updateAvailable = signal<UpdateAvailable | null>(null);

/** Version that was dismissed (persisted to localStorage) */
const dismissedVersion = signal<string | null>(
  typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null,
);

// ============================================
// Initialization
// ============================================

let initialized = false;

export function initUpdateSubscription(): void {
  if (initialized) return;
  initialized = true;

  subscribe((event) => {
    if (event.event === "update.available" && event.payload) {
      const payload = event.payload as { updateAvailable?: unknown };
      updateAvailable.value = isUpdateAvailable(payload.updateAvailable)
        ? payload.updateAvailable
        : null;
    }
  });
}

// ============================================
// Computed
// ============================================

/** Whether the current update has been dismissed */
export function isUpdateDismissed(): boolean {
  const update = updateAvailable.value;
  if (!update) return false;
  return dismissedVersion.value === update.latestVersion;
}

// ============================================
// Actions
// ============================================

export function dismissUpdate(): void {
  const update = updateAvailable.value;
  if (update) {
    dismissedVersion.value = update.latestVersion;
    localStorage.setItem(STORAGE_KEY, update.latestVersion);
  }
}
