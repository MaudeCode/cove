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
import { IconButton, Select, Badge } from "@/components/ui";

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

// ============================================
// Icons
// ============================================

function MenuIcon() {
  return (
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M4 6h16M4 12h16M4 18h16"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
  );
}

function LogoutIcon() {
  return (
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      />
    </svg>
  );
}
