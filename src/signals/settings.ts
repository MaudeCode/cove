/**
 * Settings Signals
 *
 * User preferences that persist to localStorage.
 *
 * @see Phase 0.9 in ROADMAP.md for full spec
 */

import { signal } from "@preact/signals";

export type Theme = "light" | "dark" | "system";
export type TimeFormat = "relative" | "local";
export type FontSize = "sm" | "md" | "lg";

/** Color theme preference */
export const theme = signal<Theme>("system");

/** Current locale for i18n */
export const locale = signal<string>("en");

/** How to display timestamps */
export const timeFormat = signal<TimeFormat>("relative");

/** UI font size */
export const fontSize = signal<FontSize>("md");

/** Font family preference */
export const fontFamily = signal<string>("geist");
