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
import { gruvboxDarkTheme, gruvboxLightTheme } from "./gruvbox";
import { solarizedDarkTheme, solarizedLightTheme } from "./solarized";
import { oneDarkTheme } from "./one-dark";
import { tokyoNightTheme, tokyoNightDayTheme } from "./tokyo-night";
import { rosePineTheme, rosePineMoonTheme, rosePineDawnTheme } from "./rose-pine";
import { githubDarkTheme, githubLightTheme, githubDimmedTheme } from "./github";
import { monokaiTheme } from "./monokai";

/** All built-in themes */
export const builtInThemes: Theme[] = [
  // Defaults
  lightTheme,
  darkTheme,
  // Popular dark themes
  draculaTheme,
  oneDarkTheme,
  monokaiTheme,
  tokyoNightTheme,
  nordTheme,
  // Catppuccin family
  catppuccinMochaTheme,
  catppuccinLatteTheme,
  // Rosé Pine family
  rosePineTheme,
  rosePineMoonTheme,
  rosePineDawnTheme,
  // Gruvbox family
  gruvboxDarkTheme,
  gruvboxLightTheme,
  // Solarized family
  solarizedDarkTheme,
  solarizedLightTheme,
  // GitHub family
  githubDarkTheme,
  githubLightTheme,
  githubDimmedTheme,
  // Tokyo Night light
  tokyoNightDayTheme,
];

/** Map of theme ID to theme definition */
const themeMap = new Map<string, Theme>(builtInThemes.map((t) => [t.id, t]));

/** Get a theme by ID (built-in or custom) */
export function getTheme(id: string, customThemes: Theme[] = []): Theme | undefined {
  return themeMap.get(id) ?? customThemes.find((t) => t.id === id);
}
