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
import { initI18n, t, formatRelativeTime, formatNumber, formatBytes } from "@/lib/i18n";

export function App() {
  // Initialize systems on mount
  useEffect(() => {
    initTheme();
    initI18n();
  }, []);

  const themes = getAllThemes();
  const current = activeTheme.value;
  const pref = themePreference.value;

  // Demo dates for relative time
  const now = Date.now();
  const twoHoursAgo = now - 2 * 60 * 60 * 1000;
  const yesterday = now - 24 * 60 * 60 * 1000;

  return (
    <div class="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex items-center justify-center transition-colors">
      <div class="text-center max-w-md px-4">
        <h1 class="text-4xl font-bold mb-2">🏖️ {t("app.name")}</h1>
        <p class="text-[var(--color-text-secondary)]">{t("app.description")}</p>
        <p class="text-[var(--color-text-muted)] text-sm mt-1">{t("app.tagline")}</p>

        {/* Phase indicator */}
        <div class="mt-6 p-3 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border)]">
          <p class="text-xs text-[var(--color-text-muted)]">Phase 0.3 — i18n Infrastructure</p>
        </div>

        {/* Theme selector */}
        <div class="mt-6">
          <label
            htmlFor="theme-select"
            class="block text-sm text-[var(--color-text-secondary)] mb-2"
          >
            {t("settings.appearance.theme")}: {current.name}
            {pref.selected === "system" && ` (${t("settings.appearance.themeSystem")})`}
          </label>
          <select
            id="theme-select"
            value={pref.selected}
            onChange={(e) => setTheme((e.target as HTMLSelectElement).value)}
            class="w-full px-3 py-2 rounded-md bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          >
            <option value="system">{t("settings.appearance.themeSystem")}</option>
            {themes.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.name}
              </option>
            ))}
          </select>
        </div>

        {/* i18n Demo */}
        <div class="mt-6 space-y-3 text-left p-4 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border)]">
          <h3 class="text-sm font-medium text-[var(--color-text-primary)]">i18n Demo</h3>

          {/* Translated strings */}
          <div class="text-sm">
            <p class="text-[var(--color-text-muted)]">Actions:</p>
            <p class="text-[var(--color-text-secondary)]">
              {t("actions.send")} · {t("actions.cancel")} · {t("actions.newChat")}
            </p>
          </div>

          {/* Interpolation */}
          <div class="text-sm">
            <p class="text-[var(--color-text-muted)]">Interpolation:</p>
            <p class="text-[var(--color-text-secondary)]">
              {t("sessions.count", { count: 1 })} · {t("sessions.count", { count: 5 })}
            </p>
          </div>

          {/* Relative time */}
          <div class="text-sm">
            <p class="text-[var(--color-text-muted)]">Relative Time:</p>
            <p class="text-[var(--color-text-secondary)]">
              {formatRelativeTime(twoHoursAgo)} · {formatRelativeTime(yesterday)}
            </p>
          </div>

          {/* Number formatting */}
          <div class="text-sm">
            <p class="text-[var(--color-text-muted)]">Numbers:</p>
            <p class="text-[var(--color-text-secondary)]">
              {formatNumber(1234567)} · {formatBytes(1048576)} · {formatBytes(1073741824)}
            </p>
          </div>
        </div>

        {/* Color swatches */}
        <div class="mt-6 flex gap-2 justify-center">
          <div class="w-8 h-8 rounded-md bg-[var(--color-accent)]" title="Accent" />
          <div class="w-8 h-8 rounded-md bg-[var(--color-success)]" title="Success" />
          <div class="w-8 h-8 rounded-md bg-[var(--color-warning)]" title="Warning" />
          <div class="w-8 h-8 rounded-md bg-[var(--color-error)]" title="Error" />
          <div class="w-8 h-8 rounded-md bg-[var(--color-info)]" title="Info" />
        </div>
      </div>
    </div>
  );
}
