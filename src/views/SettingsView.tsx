/**
 * SettingsView
 *
 * User preferences and app settings.
 */

import { t } from "@/lib/i18n";
import { Card, ThemePicker } from "@/components/ui";
import { gatewayVersion, gatewayUrl } from "@/lib/gateway";

export function SettingsView() {
  return (
    <div class="flex-1 overflow-y-auto p-6">
      <div class="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 class="text-2xl font-bold text-[var(--color-text-primary)]">{t("nav.settings")}</h1>
          <p class="text-[var(--color-text-muted)] mt-1">{t("settings.description")}</p>
        </div>

        {/* Appearance Section */}
        <Card>
          <div class="p-4 border-b border-[var(--color-border)]">
            <h2 class="text-lg font-semibold text-[var(--color-text-primary)]">
              {t("settings.appearance.title")}
            </h2>
          </div>
          <div class="p-4 space-y-6">
            {/* Theme */}
            <div class="flex items-center justify-between">
              <div>
                <label class="text-sm font-medium text-[var(--color-text-primary)]">
                  {t("settings.appearance.theme")}
                </label>
                <p class="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {t("settings.appearance.themeDescription")}
                </p>
              </div>
              <ThemePicker />
            </div>

            {/* Font Size - TODO */}
            <div class="flex items-center justify-between opacity-50">
              <div>
                <label class="text-sm font-medium text-[var(--color-text-primary)]">
                  {t("settings.appearance.fontSize")}
                </label>
                <p class="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {t("settings.appearance.fontSizeDescription")}
                </p>
              </div>
              <span class="text-xs text-[var(--color-text-muted)] italic">Coming soon</span>
            </div>

            {/* Font Family - TODO */}
            <div class="flex items-center justify-between opacity-50">
              <div>
                <label class="text-sm font-medium text-[var(--color-text-primary)]">
                  {t("settings.appearance.fontFamily")}
                </label>
                <p class="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {t("settings.appearance.fontFamilyDescription")}
                </p>
              </div>
              <span class="text-xs text-[var(--color-text-muted)] italic">Coming soon</span>
            </div>
          </div>
        </Card>

        {/* About Section */}
        <Card>
          <div class="p-4 border-b border-[var(--color-border)]">
            <h2 class="text-lg font-semibold text-[var(--color-text-primary)]">
              {t("settings.about.title")}
            </h2>
          </div>
          <div class="p-4 space-y-3">
            <div class="flex justify-between text-sm">
              <span class="text-[var(--color-text-muted)]">Cove</span>
              <span class="text-[var(--color-text-primary)]">v0.1.0</span>
            </div>
            {gatewayVersion.value && (
              <div class="flex justify-between text-sm">
                <span class="text-[var(--color-text-muted)]">Gateway</span>
                <span class="text-[var(--color-text-primary)]">v{gatewayVersion.value}</span>
              </div>
            )}
            {gatewayUrl.value && (
              <div class="flex justify-between text-sm">
                <span class="text-[var(--color-text-muted)]">Gateway URL</span>
                <span class="text-[var(--color-text-primary)] truncate max-w-[200px]">
                  {gatewayUrl.value}
                </span>
              </div>
            )}
          </div>
        </Card>

        {/* Links Section */}
        <Card>
          <div class="p-4 border-b border-[var(--color-border)]">
            <h2 class="text-lg font-semibold text-[var(--color-text-primary)]">
              {t("settings.links.title")}
            </h2>
          </div>
          <div class="p-4 space-y-2">
            <a
              href="https://docs.openclaw.ai"
              target="_blank"
              rel="noopener noreferrer"
              class="block text-sm text-[var(--color-accent)] hover:underline"
            >
              📚 Documentation
            </a>
            <a
              href="https://github.com/openclaw/openclaw"
              target="_blank"
              rel="noopener noreferrer"
              class="block text-sm text-[var(--color-accent)] hover:underline"
            >
              🐙 GitHub
            </a>
            <a
              href="https://discord.com/invite/clawd"
              target="_blank"
              rel="noopener noreferrer"
              class="block text-sm text-[var(--color-accent)] hover:underline"
            >
              💬 Discord Community
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
}
