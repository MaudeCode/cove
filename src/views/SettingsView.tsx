/**
 * SettingsView
 *
 * User preferences and app settings.
 */

import type { ComponentChildren } from "preact";
import { t } from "@/lib/i18n";
import { Button, Card, Dropdown } from "@/components/ui";
import { ThemeSettings } from "@/components/settings";
import { gatewayVersion, gatewayUrl, isConnected } from "@/lib/gateway";
import { logout } from "@/lib/logout";
import {
  fontSize,
  fontFamily,
  timeFormat,
  FONT_SIZE_OPTIONS,
  FONT_FAMILY_OPTIONS,
  TIME_FORMAT_OPTIONS,
  resetToDefaults,
  type FontSize,
  type FontFamily,
  type TimeFormat,
} from "@/signals/settings";
import { APP_VERSION } from "@/lib/constants";

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
            {/* Theme selection - full layout */}
            <ThemeSettings />

            <SettingRow
              labelKey="settings.appearance.fontSize"
              descriptionKey="settings.appearance.fontSizeDescription"
            >
              <Dropdown
                value={fontSize.value}
                onChange={(value) => {
                  fontSize.value = value as FontSize;
                }}
                options={FONT_SIZE_OPTIONS.map((opt) => ({
                  value: opt.value,
                  label: t(opt.labelKey),
                }))}
                size="sm"
              />
            </SettingRow>

            <SettingRow
              labelKey="settings.appearance.fontFamily"
              descriptionKey="settings.appearance.fontFamilyDescription"
            >
              <Dropdown
                value={fontFamily.value}
                onChange={(value) => {
                  fontFamily.value = value as FontFamily;
                }}
                options={FONT_FAMILY_OPTIONS.map((opt) => ({
                  value: opt.value,
                  label: t(opt.labelKey),
                }))}
                size="sm"
              />
            </SettingRow>
          </div>
        </SettingsSection>

        {/* Preferences Section */}
        <SettingsSection titleKey="settings.preferences.title">
          <div class="space-y-6">
            <SettingRow
              labelKey="settings.preferences.timeFormat"
              descriptionKey="settings.preferences.timeFormatDescription"
            >
              <Dropdown
                value={timeFormat.value}
                onChange={(value) => {
                  timeFormat.value = value as TimeFormat;
                }}
                options={TIME_FORMAT_OPTIONS.map((opt) => ({
                  value: opt.value,
                  label: t(opt.labelKey),
                }))}
                size="sm"
              />
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

        {/* Reset to Defaults */}
        <SettingsSection titleKey="settings.data.title">
          <div class="flex items-center justify-between">
            <p class="text-sm text-[var(--color-text-muted)]">
              {t("settings.data.resetDefaultsDescription")}
            </p>
            <Button variant="secondary" onClick={() => resetToDefaults()}>
              {t("settings.data.resetDefaults")}
            </Button>
          </div>
        </SettingsSection>

        {/* Account Section */}
        {isConnected.value && (
          <SettingsSection titleKey="settings.account.title">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-[var(--color-text-primary)]">
                  {t("settings.account.logoutDescription")}
                </p>
              </div>
              <Button variant="secondary" onClick={() => logout()}>
                {t("actions.logout")}
              </Button>
            </div>
          </SettingsSection>
        )}
      </div>
    </div>
  );
}
