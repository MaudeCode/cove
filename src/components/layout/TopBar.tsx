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
import {
  IconButton,
  Select,
  Badge,
  CloseIcon,
  MenuIcon,
  SettingsIcon,
  LogoutIcon,
} from "@/components/ui";

export function TopBar() {
  const themes = getAllThemes();
  const pref = themePreference.value;

  // Build theme options for Select
  const themeOptions = [
    { value: "system", label: t("settings.appearance.themeSystem") },
    ...themes.map((theme) => ({ value: theme.id, label: theme.name })),
  ];

  return (
    <header class="h-14 flex-shrink-0 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)]">
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
            <Badge variant={getStatusVariant(connectionState.value)} dot size="sm">
              <span class="hidden sm:inline">
                {getStatusLabel(connectionState.value)}
                {isConnected.value && gatewayVersion.value && (
                  <span class="text-[var(--color-text-muted)]"> v{gatewayVersion.value}</span>
                )}
              </span>
            </Badge>
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

function getStatusVariant(state: string): "success" | "warning" | "error" | "default" {
  switch (state) {
    case "connected":
      return "success";
    case "connecting":
    case "authenticating":
    case "reconnecting":
      return "warning";
    case "error":
      return "error";
    default:
      return "default";
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
