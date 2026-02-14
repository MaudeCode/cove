/**
 * Config Navigation Signals
 *
 * State management for config view navigation (path selection, expansion).
 * Uses ?section= query param for URL state (consistent with other views).
 */

import { signal } from "@preact/signals";

// ============================================
// Constants
// ============================================

const STORAGE_KEY_EXPANDED = "cove:config:expandedNav";

// ============================================
// Path Parsing
// ============================================

/** Parse URL query param to path array: ?section=gateway.controlUi → ["gateway", "controlUi"] */
export function parseParamToPath(): (string | number)[] {
  const params = new URLSearchParams(window.location.search);
  const section = params.get("section");
  if (!section) return [];

  return section.split(".").map((segment) => {
    // Convert numeric strings to numbers (for array indices)
    const num = Number(segment);
    return Number.isInteger(num) && num >= 0 ? num : segment;
  });
}

/** Convert path array to query param value: ["gateway", "controlUi"] → "gateway.controlUi" */
export function pathToParam(path: (string | number)[]): string {
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

/** Currently selected path in the nav tree (synced with URL ?section= param) */
export const selectedPath = signal<(string | number)[]>(parseParamToPath());

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

// Sync selectedPath → URL ?section= param
let isUpdatingParam = false;
selectedPath.subscribe((path) => {
  const newValue = pathToParam(path);
  const params = new URLSearchParams(window.location.search);
  const currentValue = params.get("section") ?? "";

  if (newValue !== currentValue) {
    isUpdatingParam = true;
    if (newValue) {
      params.set("section", newValue);
    } else {
      params.delete("section");
    }
    const search = params.toString();
    const newUrl = window.location.pathname + (search ? `?${search}` : "") + window.location.hash;
    history.replaceState(null, "", newUrl);
    isUpdatingParam = false;
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

// Sync URL ?section= → selectedPath (for back/forward navigation)
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    if (!isUpdatingParam) {
      selectedPath.value = parseParamToPath();
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
