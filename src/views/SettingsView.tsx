/**
 * SettingsView
 *
 * User preferences and app settings.
 */

import type { ComponentChildren } from "preact";
import { t } from "@/lib/i18n";
import { Card, ThemePicker } from "@/components/ui";
import { gatewayVersion, gatewayUrl } from "@/lib/gateway";
import { APP_VERSION, EXTERNAL_URLS } from "@/lib/constants";

// ============================================
// Helper Components (view-local)
// ============================================

interface SettingsSectionProps {
  titleKey: string;
  children: ComponentChildren;
}

/** Card with a header and content area */
function SettingsSection({ titleKey, children }: SettingsSectionProps) {
  return (
    <Card>
      <div class="p-4 border-b border-[var(--color-border)]">
        <h2 class="text-lg font-semibold text-[var(--color-text-primary)]">{t(titleKey)}</h2>
      </div>
      <div class="p-4">{children}</div>
    </Card>
  );
}

interface SettingRowProps {
  labelKey: string;
  descriptionKey: string;
  disabled?: boolean;
  children: ComponentChildren;
}

/** A setting row with label, description, and control */
function SettingRow({ labelKey, descriptionKey, disabled, children }: SettingRowProps) {
  return (
    <div class={`flex items-center justify-between ${disabled ? "opacity-50" : ""}`}>
      <div>
        <label class="text-sm font-medium text-[var(--color-text-primary)]">{t(labelKey)}</label>
        <p class="text-xs text-[var(--color-text-muted)] mt-0.5">{t(descriptionKey)}</p>
      </div>
      {children}
    </div>
  );
}

interface InfoRowProps {
  label: string;
  value: string;
  truncate?: boolean;
}

/** A simple label-value row for info display */
function InfoRow({ label, value, truncate }: InfoRowProps) {
  return (
    <div class="flex justify-between text-sm">
      <span class="text-[var(--color-text-muted)]">{label}</span>
      <span class={`text-[var(--color-text-primary)] ${truncate ? "truncate max-w-[200px]" : ""}`}>
        {value}
      </span>
    </div>
  );
}

interface ExternalLinkProps {
  href: string;
  emoji: string;
  labelKey: string;
}

/** An external link with icon */
function ExternalLink({ href, emoji, labelKey }: ExternalLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      class="block text-sm text-[var(--color-accent)] hover:underline"
    >
      {emoji} {t(labelKey)}
    </a>
  );
}

/** Coming soon placeholder text */
function ComingSoon() {
  return (
    <span class="text-xs text-[var(--color-text-muted)] italic">{t("settings.comingSoon")}</span>
  );
}

// ============================================
// Main Component
// ============================================

interface SettingsViewProps {
  /** Route path (from preact-router) */
  path?: string;
}

export function SettingsView(_props: SettingsViewProps) {
  return (
    <div class="flex-1 overflow-y-auto p-6">
      <div class="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 class="text-2xl font-bold text-[var(--color-text-primary)]">{t("nav.settings")}</h1>
          <p class="text-[var(--color-text-muted)] mt-1">{t("settings.description")}</p>
        </div>

        {/* Appearance Section */}
        <SettingsSection titleKey="settings.appearance.title">
          <div class="space-y-6">
            <SettingRow
              labelKey="settings.appearance.theme"
              descriptionKey="settings.appearance.themeDescription"
            >
              <ThemePicker />
            </SettingRow>

            <SettingRow
              labelKey="settings.appearance.fontSize"
              descriptionKey="settings.appearance.fontSizeDescription"
              disabled
            >
              <ComingSoon />
            </SettingRow>

            <SettingRow
              labelKey="settings.appearance.fontFamily"
              descriptionKey="settings.appearance.fontFamilyDescription"
              disabled
            >
              <ComingSoon />
            </SettingRow>
          </div>
        </SettingsSection>

        {/* About Section */}
        <SettingsSection titleKey="settings.about.title">
          <div class="space-y-3">
            <InfoRow label={t("settings.about.cove")} value={`v${APP_VERSION}`} />
            {gatewayVersion.value && (
              <InfoRow
                label={t("settings.about.gateway")}
                value={
                  /^\d/.test(gatewayVersion.value)
                    ? `v${gatewayVersion.value}`
                    : gatewayVersion.value
                }
              />
            )}
            {gatewayUrl.value && (
              <InfoRow label={t("settings.about.gatewayUrl")} value={gatewayUrl.value} truncate />
            )}
          </div>
        </SettingsSection>

        {/* Links Section */}
        <SettingsSection titleKey="settings.links.title">
          <div class="space-y-2">
            <ExternalLink href={EXTERNAL_URLS.docs} emoji="📚" labelKey="settings.links.docs" />
            <ExternalLink href={EXTERNAL_URLS.github} emoji="🐙" labelKey="settings.links.github" />
            <ExternalLink
              href={EXTERNAL_URLS.discord}
              emoji="💬"
              labelKey="settings.links.discord"
            />
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}
