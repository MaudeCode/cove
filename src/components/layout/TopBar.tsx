/**
 * TopBar
 *
 * Header with logo, connection status, theme toggle, and settings.
 */

import { route } from "preact-router";
import { t } from "@/lib/i18n";
import { connectionState, isConnected, gatewayVersion } from "@/lib/gateway";
import { logout } from "@/lib/logout";
import { sidebarOpen } from "@/signals/ui";
import {
  IconButton,
  ThemePicker,
  CoveLogo,
  CloseIcon,
  MenuIcon,
  SettingsIcon,
  LogoutIcon,
} from "@/components/ui";
import { UsageBadge } from "@/components/usage";

export function TopBar() {
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
          <a href="/" class="flex items-center gap-2.5 font-semibold text-lg group no-underline">
            <CoveLogo size="md" animated />
            <span class="bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-warning)] bg-clip-text text-transparent">
              {t("app.name")}
            </span>
          </a>
        </div>

        {/* Right side: connection status + theme + settings */}
        <div class="flex items-center gap-4">
          {/* Connection status - always visible, fade in quickly to hide initial disconnected state */}
          {(() => {
            const style = getStatusStyle(connectionState.value);
            return (
              <div class="flex items-center gap-2 text-sm animate-[fade-in_150ms_ease-out_100ms_forwards] opacity-0">
                <span class={`w-2 h-2 rounded-full ${style.dot}`} aria-hidden="true" />
                <span class={`hidden sm:inline ${style.text}`}>
                  {t(style.label)}
                  {isConnected.value && gatewayVersion.value && gatewayVersion.value !== "dev" && (
                    <span class="text-[var(--color-text-muted)]"> v{gatewayVersion.value}</span>
                  )}
                </span>
              </div>
            );
          })()}

          {/* Usage badge - only shows when Anthropic OAuth is active */}
          <UsageBadge />

          {/* Theme selector */}
          <ThemePicker />

          {/* Settings button */}
          <IconButton
            icon={<SettingsIcon />}
            label={t("nav.settings")}
            onClick={() => route("/settings")}
            variant="ghost"
            size="md"
          />

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

interface StatusStyle {
  dot: string;
  text: string;
  label: string;
}

const STATUS_STYLES: Record<string, StatusStyle> = {
  connected: {
    dot: "bg-[var(--color-success)]",
    text: "text-[var(--color-success)]",
    label: "status.connected",
  },
  connecting: {
    dot: "bg-[var(--color-warning)]",
    text: "text-[var(--color-warning)]",
    label: "status.connecting",
  },
  authenticating: {
    dot: "bg-[var(--color-warning)]",
    text: "text-[var(--color-warning)]",
    label: "status.connecting",
  },
  reconnecting: {
    dot: "bg-[var(--color-warning)]",
    text: "text-[var(--color-warning)]",
    label: "status.reconnecting",
  },
  error: {
    dot: "bg-[var(--color-error)]",
    text: "text-[var(--color-error)]",
    label: "status.error",
  },
  disconnected: {
    dot: "bg-[var(--color-text-muted)]",
    text: "text-[var(--color-text-muted)]",
    label: "status.disconnected",
  },
};

function getStatusStyle(state: string): StatusStyle {
  return STATUS_STYLES[state] ?? STATUS_STYLES.disconnected;
}
