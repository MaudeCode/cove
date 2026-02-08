/**
 * Command Palette Types
 */

import { t } from "@/lib/i18n";

export type CommandCategory = "chat" | "session" | "model" | "cron" | "gateway" | "settings";

export interface Command {
  /** Unique identifier */
  id: string;
  /** Display label (i18n key or function returning translated string) */
  label: string;
  /** Category for grouping */
  category: CommandCategory;
  /** Optional keyboard shortcut (display only) */
  shortcut?: string;
  /** Icon (emoji or lucide icon name) */
  icon?: string;
  /** Action to execute (if no submenu) */
  action?: () => void | boolean | Promise<void | boolean>;
  /** Whether this command opens a submenu */
  hasSubmenu?: boolean;
  /** Function to get submenu items */
  getSubmenuItems?: () => Promise<SubMenuItem[]> | SubMenuItem[];
  /** Current value (for toggles/status display) */
  getValue?: () => string | undefined;
  /** Whether command is available in current context */
  isAvailable?: () => boolean;
  /** Keywords for fuzzy search */
  keywords?: string[];
}

export interface SubMenuItem {
  id: string;
  label: string;
  /** Whether this is the currently selected/active item */
  isActive?: boolean;
  /** Action when selected */
  action: () => void | boolean | Promise<void | boolean>;
  /** Optional description */
  description?: string;
}

/** Get category display name (translated) */
export function getCategoryLabel(category: CommandCategory | "recent"): string {
  return t(`commandPalette.categories.${category}`);
}

/** Category order for display */
export const CATEGORY_ORDER: CommandCategory[] = [
  "chat",
  "session",
  "model",
  "cron",
  "gateway",
  "settings",
];
