/**
 * Theme Utilities
 *
 * Manages theme state and applies to DOM.
 */

import { effect } from "@preact/signals";
import { theme, fontSize, fontFamily } from "@/signals/settings";

export type ThemeValue = "light" | "dark" | "system";

/**
 * Get the resolved theme (accounting for system preference)
 */
export function getResolvedTheme(value: ThemeValue): "light" | "dark" {
  if (value === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return value;
}

/**
 * Apply theme to the document
 */
export function applyTheme(value: ThemeValue): void {
  const resolved = getResolvedTheme(value);

  if (value === "system") {
    // Remove data-theme to let CSS media query handle it
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", resolved);
  }

  // Update meta theme-color for mobile browsers
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute("content", resolved === "dark" ? "#0a0a0b" : "#ffffff");
  }
}

/**
 * Apply font size to the document
 */
export function applyFontSize(size: "sm" | "md" | "lg"): void {
  document.documentElement.setAttribute("data-font-size", size);
}

/**
 * Apply font family to the document
 */
export function applyFontFamily(family: string): void {
  document.documentElement.setAttribute("data-font-family", family);
}

/**
 * Initialize theme system
 * Sets up effects to sync signals with DOM
 */
export function initTheme(): void {
  // Watch for theme changes
  effect(() => {
    applyTheme(theme.value);
  });

  // Watch for font size changes
  effect(() => {
    applyFontSize(fontSize.value);
  });

  // Watch for font family changes
  effect(() => {
    applyFontFamily(fontFamily.value);
  });

  // Watch for system preference changes
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", () => {
    if (theme.value === "system") {
      applyTheme("system");
    }
  });
}
