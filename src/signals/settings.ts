/**
 * Settings Signals
 *
 * Reactive user preferences that persist to localStorage via storage.ts.
 */

import { signal, effect, computed } from "@preact/signals";
import {
  type TimeFormat,
  type FontSize,
  type FontFamily,
  type NewChatSettings,
  type AppMode,
  getTimeFormat,
  setTimeFormat,
  getFontSize,
  setFontSize,
  getFontFamily,
  setFontFamily,
  getNewChatSettings,
  setNewChatSettings,
  getAppMode,
  setAppMode,
  getCanvasNodeEnabled,
  setCanvasNodeEnabled,
} from "@/lib/storage";

// Re-export types for consumers
export type { TimeFormat, FontSize, FontFamily, NewChatSettings, AppMode } from "@/lib/storage";

// ============================================
// Signals
// ============================================

/** How to display timestamps */
export const timeFormat = signal<TimeFormat>(getTimeFormat());

/** UI font size */
export const fontSize = signal<FontSize>(getFontSize());

/** Font family preference */
export const fontFamily = signal<FontFamily>(getFontFamily());

/** New chat creation settings */
export const newChatSettings = signal<NewChatSettings>(getNewChatSettings());

/** App interface mode (single-chat vs multi-chat) */
export const appMode = signal<AppMode>(getAppMode());

/** Whether to register as a canvas node (allows agent to push content) */
export const canvasNodeEnabled = signal<boolean>(getCanvasNodeEnabled());

// ============================================
// Computed
// ============================================

/** Whether multi-chat mode is active */
export const isMultiChatMode = computed(() => appMode.value === "multi");

/** Whether single-chat mode is active */
export const isSingleChatMode = computed(() => appMode.value === "single");

// ============================================
// Persistence Effects
// ============================================

effect(() => setTimeFormat(timeFormat.value));
effect(() => setFontSize(fontSize.value));
effect(() => setFontFamily(fontFamily.value));
effect(() => setNewChatSettings(newChatSettings.value));
effect(() => setAppMode(appMode.value));
effect(() => setCanvasNodeEnabled(canvasNodeEnabled.value));

// ============================================
// Cross-Tab Sync
// ============================================

// Listen for storage changes from other tabs
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "cove:canvas-node-enabled") {
      const newValue = e.newValue === "true";
      if (canvasNodeEnabled.value !== newValue) {
        canvasNodeEnabled.value = newValue;
        // Start/stop node connection based on new value
        import("@/lib/node-connection").then((mod) => {
          if (newValue) {
            mod.startNodeConnection();
          } else {
            mod.stopNodeConnection();
          }
        });
      }
    }
  });
}

// ============================================
// DOM Application Effects
// ============================================

/** Apply font size to document */
effect(() => {
  document.documentElement.dataset.fontSize = fontSize.value;
});

/** Apply font family to document */
effect(() => {
  const families: Record<FontFamily, string> = {
    geist: '"Geist Sans", ui-sans-serif, system-ui, sans-serif',
    inter: '"Inter", ui-sans-serif, system-ui, sans-serif',
    system: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    dyslexic: '"OpenDyslexic", ui-sans-serif, system-ui, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, monospace',
  };
  document.documentElement.style.setProperty("--font-family-override", families[fontFamily.value]);
});

// ============================================
// Options (for UI dropdowns)
// ============================================

export const FONT_SIZE_OPTIONS: { value: FontSize; labelKey: string }[] = [
  { value: "sm", labelKey: "settings.appearance.fontSizeSm" },
  { value: "md", labelKey: "common.medium" },
  { value: "lg", labelKey: "settings.appearance.fontSizeLg" },
];

export const FONT_FAMILY_OPTIONS: { value: FontFamily; labelKey: string }[] = [
  { value: "system", labelKey: "settings.appearance.fontSystem" },
  { value: "geist", labelKey: "settings.appearance.fontGeist" },
  { value: "inter", labelKey: "settings.appearance.fontInter" },
  { value: "mono", labelKey: "settings.appearance.fontMono" },
  { value: "dyslexic", labelKey: "settings.appearance.fontDyslexic" },
];

export const TIME_FORMAT_OPTIONS: { value: TimeFormat; labelKey: string }[] = [
  { value: "relative", labelKey: "settings.preferences.timeRelative" },
  { value: "local", labelKey: "settings.preferences.timeAbsolute" },
];

// ============================================
// Reset
// ============================================

export function resetToDefaults(): void {
  fontSize.value = "md";
  fontFamily.value = "geist";
  timeFormat.value = "relative";
  newChatSettings.value = {
    useDefaults: true,
    defaultAgentId: "main",
  };
  appMode.value = "single";
}
