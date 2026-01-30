/**
 * TopBar
 *
 * Header with logo, connection status, theme toggle, and settings.
 */

import { t } from "@/lib/i18n";
import { themePreference, setTheme, getAllThemes } from "@/lib/theme";
import { connectionState, isConnected, gatewayVersion } from "@/lib/gateway";
import { sidebarOpen } from "@/signals/ui";

export function TopBar() {
  const themes = getAllThemes();
  const pref = themePreference.value;

  return (
    <header class="h-14 flex-shrink-0 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)]">
      <div class="h-full px-4 flex items-center justify-between">
        {/* Left side: hamburger + logo */}
        <div class="flex items-center gap-3">
          {/* Hamburger menu for mobile */}
          <button
            type="button"
            onClick={() => (sidebarOpen.value = !sidebarOpen.value)}
            class="lg:hidden p-2 -ml-2 rounded hover:bg-[var(--color-bg-primary)] transition-colors"
            aria-label={t("accessibility.sidebarToggle")}
            aria-expanded={sidebarOpen.value}
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              {sidebarOpen.value ? (
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>

          {/* Logo */}
          <a href="/" class="flex items-center gap-2 font-semibold text-lg">
            <span class="text-xl" aria-hidden="true">
              🏖️
            </span>
            <span>{t("app.name")}</span>
          </a>
        </div>

        {/* Right side: connection status + theme + settings */}
        <div class="flex items-center gap-4">
          {/* Connection status */}
          <div class="flex items-center gap-2">
            <div
              class={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusColor(connectionState.value)}`}
              aria-hidden="true"
            />
            <span class="text-sm text-[var(--color-text-secondary)] hidden sm:inline">
              {getStatusLabel(connectionState.value)}
              {isConnected.value && gatewayVersion.value && (
                <span class="text-[var(--color-text-muted)]"> v{gatewayVersion.value}</span>
              )}
            </span>
          </div>

          {/* Theme selector */}
          <select
            value={pref.selected}
            onChange={(e) => setTheme((e.target as HTMLSelectElement).value)}
            class="text-sm px-2 py-1.5 rounded bg-[var(--color-bg-primary)] border border-[var(--color-border)] cursor-pointer hover:border-[var(--color-accent)] transition-colors"
            aria-label={t("settings.appearance.theme")}
          >
            <option value="system">{t("settings.appearance.themeSystem")}</option>
            {themes.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.name}
              </option>
            ))}
          </select>

          {/* Settings button */}
          <button
            type="button"
            class="p-2 rounded hover:bg-[var(--color-bg-primary)] transition-colors"
            aria-label={t("nav.settings")}
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}

function getStatusColor(state: string): string {
  switch (state) {
    case "connected":
      return "bg-[var(--color-success)]";
    case "connecting":
    case "authenticating":
    case "reconnecting":
      return "bg-[var(--color-warning)] animate-pulse";
    case "error":
      return "bg-[var(--color-error)]";
    default:
      return "bg-[var(--color-text-muted)]";
  }
}

function getStatusLabel(state: string): string {
  switch (state) {
    case "connected":
      return t("status.connected");
    case "connecting":
      return t("status.connecting");
    case "reconnecting":
      return t("status.reconnecting");
    case "authenticating":
      return t("status.connecting");
    case "error":
      return t("status.error");
    default:
      return t("status.disconnected");
  }
}
