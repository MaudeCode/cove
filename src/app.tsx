/**
 * Main App Component
 *
 * This will be expanded in Phase 1.1 to include:
 * - Layout shell (TopBar, Sidebar, MainContent)
 * - Routing
 * - Auth state management
 */

import { useEffect } from "preact/hooks";
import { initTheme } from "@/lib/theme";
import { theme } from "@/signals/settings";

export function App() {
  // Initialize theme system on mount
  useEffect(() => {
    initTheme();
  }, []);

  const cycleTheme = () => {
    const themes: Array<"light" | "dark" | "system"> = ["light", "dark", "system"];
    const currentIndex = themes.indexOf(theme.value);
    theme.value = themes[(currentIndex + 1) % themes.length];
  };

  return (
    <div class="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex items-center justify-center transition-colors transition-normal">
      <div class="text-center">
        <h1 class="text-4xl font-bold mb-4">🏖️ Cove</h1>
        <p class="text-[var(--color-text-secondary)]">OpenClaw WebUI</p>
        <p class="text-[var(--color-text-muted)] text-sm mt-2">Phase 0.2 — Theming</p>

        <div class="mt-8 space-y-4">
          {/* Theme toggle demo */}
          <button
            onClick={cycleTheme}
            class="px-4 py-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] text-[var(--color-accent-text)] hover:bg-[var(--color-accent-hover)] transition-colors transition-fast"
            aria-label="Toggle theme"
          >
            Theme: {theme.value}
          </button>

          {/* Color swatches demo */}
          <div class="flex gap-2 justify-center mt-6">
            <div
              class="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--color-success)]"
              title="Success"
            />
            <div
              class="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--color-warning)]"
              title="Warning"
            />
            <div class="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--color-error)]" title="Error" />
            <div class="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--color-info)]" title="Info" />
          </div>

          {/* Surface demo */}
          <div class="mt-6 p-4 rounded-[var(--radius-lg)] bg-[var(--color-bg-surface)] border border-[var(--color-border)]">
            <p class="text-[var(--color-text-secondary)] text-sm">Surface with border</p>
          </div>
        </div>
      </div>
    </div>
  );
}
