/**
 * Main App Component
 *
 * This will be expanded in Phase 1.1 to include:
 * - Layout shell (TopBar, Sidebar, MainContent)
 * - Routing
 * - Auth state management
 */

import { useEffect } from "preact/hooks";
import { initTheme, themePreference, activeTheme, setTheme, getAllThemes } from "@/lib/theme";

export function App() {
  // Initialize theme system on mount
  useEffect(() => {
    initTheme();
  }, []);

  const themes = getAllThemes();
  const current = activeTheme.value;
  const pref = themePreference.value;

  return (
    <div class="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex items-center justify-center transition-colors">
      <div class="text-center max-w-md px-4">
        <h1 class="text-4xl font-bold mb-4">🏖️ Cove</h1>
        <p class="text-[var(--color-text-secondary)]">OpenClaw WebUI</p>
        <p class="text-[var(--color-text-muted)] text-sm mt-2">Phase 0.2 — Multi-Theme System</p>

        {/* Current theme info */}
        <div class="mt-6 p-4 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border)]">
          <p class="text-sm text-[var(--color-text-secondary)]">
            Current:{" "}
            <span class="font-medium text-[var(--color-text-primary)]">{current.name}</span>
            {pref.selected === "system" && (
              <span class="text-[var(--color-text-muted)]"> (System)</span>
            )}
          </p>
        </div>

        {/* Theme selector */}
        <div class="mt-6">
          <label
            htmlFor="theme-select"
            class="block text-sm text-[var(--color-text-secondary)] mb-2"
          >
            Select Theme
          </label>
          <select
            id="theme-select"
            value={pref.selected}
            onChange={(e) => setTheme((e.target as HTMLSelectElement).value)}
            class="w-full px-3 py-2 rounded-md bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          >
            <option value="system">System (Auto)</option>
            {themes.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.name} ({theme.appearance})
              </option>
            ))}
          </select>
        </div>

        {/* Color swatches demo */}
        <div class="mt-6">
          <p class="text-sm text-[var(--color-text-muted)] mb-2">Accent & Status Colors</p>
          <div class="flex gap-2 justify-center">
            <div class="w-8 h-8 rounded-md bg-[var(--color-accent)]" title="Accent" />
            <div class="w-8 h-8 rounded-md bg-[var(--color-success)]" title="Success" />
            <div class="w-8 h-8 rounded-md bg-[var(--color-warning)]" title="Warning" />
            <div class="w-8 h-8 rounded-md bg-[var(--color-error)]" title="Error" />
            <div class="w-8 h-8 rounded-md bg-[var(--color-info)]" title="Info" />
          </div>
        </div>

        {/* Background swatches */}
        <div class="mt-4">
          <p class="text-sm text-[var(--color-text-muted)] mb-2">Background Layers</p>
          <div class="flex gap-2 justify-center">
            <div
              class="w-8 h-8 rounded-md bg-[var(--color-bg-primary)] border border-[var(--color-border)]"
              title="Primary"
            />
            <div
              class="w-8 h-8 rounded-md bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
              title="Secondary"
            />
            <div
              class="w-8 h-8 rounded-md bg-[var(--color-bg-surface)] border border-[var(--color-border)]"
              title="Surface"
            />
            <div
              class="w-8 h-8 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border)]"
              title="Elevated"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
