/**
 * TopBar
 *
 * Header with logo, connection status, theme toggle, and settings.
 */

import { t } from "@/lib/i18n";
import { themePreference, setTheme, getAllThemes } from "@/lib/theme";
import { connectionState, isConnected, gatewayVersion } from "@/lib/gateway";
import { logout } from "@/lib/logout";
import { sidebarOpen } from "@/signals/ui";
import { IconButton, Select, CloseIcon, MenuIcon, SettingsIcon, LogoutIcon } from "@/components/ui";

export function TopBar() {
  const themes = getAllThemes();
  const pref = themePreference.value;

  // Build theme options for Select
  const themeOptions = [
    { value: "system", label: t("settings.appearance.themeSystem") },
    ...themes.map((theme) => ({ value: theme.id, label: theme.name })),
  ];

  return (
    <header class="h-14 flex-shrink-0 bg-[var(--color-bg-secondary)]">
      <div class="h-full px-4 flex items-center justify-between">
        {/* Left side: hamburger + logo */}
        <div class="flex items-center gap-3">
          {/* Hamburger menu for mobile */}
          <div class="lg:hidden">
            <IconButton
              icon={sidebarOpen.value ? <CloseIcon /> : <MenuIcon />}
              label={t("accessibility.sidebarToggle")}
              onClick={() => (sidebarOpen.value = !sidebarOpen.value)}
              variant="ghost"
              size="md"
            />
          </div>

          {/* Logo */}
          <a href="/" class="flex items-center gap-2.5 font-semibold text-lg group">
            <span class="text-xl group-hover:scale-110 transition-transform" aria-hidden="true">
              🦞
            </span>
            <span class="bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-warning)] bg-clip-text text-transparent">
              {t("app.name")}
            </span>
          </a>
        </div>

        {/* Right side: connection status + theme + settings */}
        <div class="flex items-center gap-4">
          {/* Connection status */}
          <div class="flex items-center gap-2 text-sm">
            <span
              class={`w-2 h-2 rounded-full ${getStatusDotColor(connectionState.value)}`}
              aria-hidden="true"
            />
            <span class={`hidden sm:inline ${getStatusTextColor(connectionState.value)}`}>
              {getStatusLabel(connectionState.value)}
              {isConnected.value && gatewayVersion.value && gatewayVersion.value !== "dev" && (
                <span class="text-[var(--color-text-muted)]"> v{gatewayVersion.value}</span>
              )}
            </span>
          </div>

          {/* Theme selector */}
          <Select
            value={pref.selected}
            onChange={(e) => setTheme((e.target as HTMLSelectElement).value)}
            options={themeOptions}
            size="sm"
            aria-label={t("settings.appearance.theme")}
          />

          {/* Settings button */}
          <IconButton icon={<SettingsIcon />} label={t("nav.settings")} variant="ghost" size="md" />

          {/* Logout button - only shown when connected */}
          {isConnected.value && (
            <IconButton
              icon={<LogoutIcon />}
              label={t("actions.logout")}
              onClick={() => logout()}
              variant="ghost"
              size="md"
            />
          )}
        </div>
      </div>
    </header>
  );
}

// ============================================
// Helpers
// ============================================

function getStatusDotColor(state: string): string {
  switch (state) {
    case "connected":
      return "bg-[var(--color-success)]";
    case "connecting":
    case "authenticating":
    case "reconnecting":
      return "bg-[var(--color-warning)]";
    case "error":
      return "bg-[var(--color-error)]";
    default:
      return "bg-[var(--color-text-muted)]";
  }
}

function getStatusTextColor(state: string): string {
  switch (state) {
    case "connected":
      return "text-[var(--color-success)]";
    case "connecting":
    case "authenticating":
    case "reconnecting":
      return "text-[var(--color-warning)]";
    case "error":
      return "text-[var(--color-error)]";
    default:
      return "text-[var(--color-text-muted)]";
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
