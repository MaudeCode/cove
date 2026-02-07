/**
 * Config Navigation Signals
 *
 * State management for config view navigation (path selection, expansion).
 */

import { signal } from "@preact/signals";

// ============================================
// Constants
// ============================================

const STORAGE_KEY_EXPANDED = "cove:config:expandedNav";

// ============================================
// Path Parsing
// ============================================

/** Parse URL hash to path array: #gateway.controlUi → ["gateway", "controlUi"] */
export function parseHashToPath(): (string | number)[] {
  const hash = window.location.hash.slice(1); // Remove #
  if (!hash) return [];

  return hash.split(".").map((segment) => {
    // Convert numeric strings to numbers (for array indices)
    const num = Number(segment);
    return Number.isInteger(num) && num >= 0 ? num : segment;
  });
}

/** Convert path array to URL hash: ["gateway", "controlUi"] → "gateway.controlUi" */
export function pathToHash(path: (string | number)[]): string {
  if (path.length === 0) return "";
  return path.join(".");
}

// ============================================
// Persistence
// ============================================

/** Load persisted expanded nav from localStorage */
function loadPersistedExpanded(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_EXPANDED);
    if (stored) return new Set(JSON.parse(stored));
  } catch {
    // Ignore parse errors
  }
  return new Set(["gateway", "agents", "channels"]);
}

// ============================================
// Signals
// ============================================

/** Currently selected path in the nav tree (synced with URL hash) */
export const selectedPath = signal<(string | number)[]>(parseHashToPath());

/** Expanded nav items */
export const expandedNav = signal<Set<string>>(loadPersistedExpanded());

/** Mobile: viewing detail panel instead of nav for current path */
export const mobileViewingDetail = signal(false);

// ============================================
// Side Effects
// ============================================

// Reset detail view when path changes
selectedPath.subscribe(() => {
  mobileViewingDetail.value = false;
});

// Sync selectedPath → URL hash (without triggering hashchange)
let isUpdatingHash = false;
selectedPath.subscribe((path) => {
  const newHash = pathToHash(path);
  const currentHash = window.location.hash.slice(1);
  if (newHash !== currentHash) {
    isUpdatingHash = true;
    if (newHash) {
      window.location.hash = newHash;
    } else {
      // Remove hash without adding to history
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    isUpdatingHash = false;
  }

  // Auto-expand parent paths so selected item is visible
  if (path.length > 1) {
    const next = new Set(expandedNav.value);
    for (let i = 1; i < path.length; i++) {
      next.add(path.slice(0, i).join("."));
    }
    expandedNav.value = next;
  }
});

// Sync URL hash → selectedPath (for back/forward navigation)
if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => {
    if (!isUpdatingHash) {
      selectedPath.value = parseHashToPath();
    }
  });
}

// Persist expanded nav to localStorage
expandedNav.subscribe((expanded) => {
  try {
    localStorage.setItem(STORAGE_KEY_EXPANDED, JSON.stringify([...expanded]));
  } catch {
    // Ignore storage errors
  }
});
