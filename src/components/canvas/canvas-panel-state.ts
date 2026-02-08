/**
 * Canvas Panel State
 *
 * Module-level state for the canvas panel.
 * Signals persist across mount/unmount cycles.
 */

import { signal, computed, effect } from "@preact/signals";

// Storage key for persisting panel state
const STORAGE_KEY = "cove:canvasPanel";

export type DockPosition = "floating" | "left" | "top" | "right";

interface PersistedState {
  dockPosition: DockPosition;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Load persisted state with bounds checking
function loadPersistedState(): PersistedState | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const state = JSON.parse(stored) as PersistedState;
      // Validate bounds - ensure panel is visible
      const maxX = window.innerWidth - 100;
      const maxY = window.innerHeight - 50;
      if (state.x > maxX || state.x < 0) state.x = 100;
      if (state.y > maxY || state.y < 0) state.y = 100;
      if (state.width > window.innerWidth) state.width = 400;
      if (state.height > window.innerHeight) state.height = 350;
      return state;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

const persisted = loadPersistedState();

// Panel state signals
export const dockPosition = signal<DockPosition>(persisted?.dockPosition ?? "floating");
export const panelX = signal(persisted?.x ?? 100);
export const panelY = signal(persisted?.y ?? 100);
export const panelWidth = signal(persisted?.width ?? 400);
export const panelHeight = signal(persisted?.height ?? 350);
export const isMinimized = signal(false);
export const priorDockPosition = signal<DockPosition>("floating");
export const isInteracting = signal(false);

// Persist state changes
effect(() => {
  const state: PersistedState = {
    dockPosition: dockPosition.value,
    x: panelX.value,
    y: panelY.value,
    width: panelWidth.value,
    height: panelHeight.value,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
});

// Constraints
export const MIN_WIDTH = 280;
export const MIN_HEIGHT = 200;
export const MAX_DOCKED_WIDTH_PERCENT = 0.5;
export const MAX_DOCKED_HEIGHT_PERCENT = 0.6;
export const DOCK_THRESHOLD = 40;
export const HEADER_HEIGHT = 44;
export const TOPBAR_HEIGHT = 56; // h-14 from TopBar

// Computed panel style based on dock position
export const panelStyle = computed(() => {
  if (isMinimized.value) {
    return {
      width: "auto",
      height: `${HEADER_HEIGHT}px`,
      left: `${panelX.value}px`,
      top: `${panelY.value}px`,
      borderRadius: "9999px",
    };
  }

  switch (dockPosition.value) {
    case "left":
      return {
        left: "0",
        top: "0",
        width: `${panelWidth.value}px`,
        height: "100%",
        borderRadius: "0 12px 12px 0",
      };
    case "right":
      return {
        right: "0",
        top: "0",
        width: `${panelWidth.value}px`,
        height: "100%",
        borderRadius: "12px 0 0 12px",
      };
    case "top":
      return {
        left: "0",
        top: `${TOPBAR_HEIGHT}px`,
        width: "100%",
        height: `${panelHeight.value}px`,
        borderRadius: "0 0 12px 12px",
      };
    default:
      return {
        left: `${panelX.value}px`,
        top: `${panelY.value}px`,
        width: `${panelWidth.value}px`,
        height: `${panelHeight.value}px`,
        borderRadius: "12px",
      };
  }
});

// Helper to get coordinates from mouse or touch event
export function getPointerCoords(e: MouseEvent | TouchEvent): { x: number; y: number } {
  if ("touches" in e) {
    const touch = e.touches[0] || e.changedTouches[0];
    return { x: touch.clientX, y: touch.clientY };
  }
  return { x: e.clientX, y: e.clientY };
}
