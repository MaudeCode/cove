/**
 * Command Palette Keyboard Shortcut Hook
 *
 * Listens for ⌘K (Mac) or Ctrl+K (Windows/Linux) to open the command palette.
 */

import { useEffect } from "preact/hooks";
import { commandPaletteOpen } from "./CommandPalette";

export function useCommandPaletteShortcut() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘K or Ctrl+K to toggle
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        e.stopPropagation();
        commandPaletteOpen.value = !commandPaletteOpen.value;
      }
    };

    // Use capture phase to run before other handlers
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, []);
}
