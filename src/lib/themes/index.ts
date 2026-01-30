/**
 * Built-in Theme Definitions
 */

import type { Theme } from "@/types/theme";

// Import all built-in themes
import { lightTheme } from "./light";
import { darkTheme } from "./dark";
import { draculaTheme } from "./dracula";
import { catppuccinMochaTheme, catppuccinLatteTheme } from "./catppuccin";
import { nordTheme } from "./nord";

/** All built-in themes */
export const builtInThemes: Theme[] = [
  lightTheme,
  darkTheme,
  draculaTheme,
  catppuccinMochaTheme,
  catppuccinLatteTheme,
  nordTheme,
];

/** Map of theme ID to theme definition */
export const themeMap = new Map<string, Theme>(builtInThemes.map((t) => [t.id, t]));

/** Get a theme by ID (built-in or custom) */
export function getTheme(id: string, customThemes: Theme[] = []): Theme | undefined {
  return themeMap.get(id) ?? customThemes.find((t) => t.id === id);
}

/** Get all themes (built-in + custom) */
export function getAllThemes(customThemes: Theme[] = []): Theme[] {
  return [...builtInThemes, ...customThemes];
}

/** Get themes by appearance */
export function getThemesByAppearance(
  appearance: "light" | "dark",
  customThemes: Theme[] = [],
): Theme[] {
  return getAllThemes(customThemes).filter((t) => t.appearance === appearance);
}
