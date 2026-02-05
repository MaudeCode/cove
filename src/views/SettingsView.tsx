/**
 * SettingsView
 *
 * User preferences and app settings.
 */

import type { ComponentChildren } from "preact";
import { t } from "@/lib/i18n";
import { ViewErrorBoundary } from "@/components/ui/ViewErrorBoundary";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dropdown } from "@/components/ui/Dropdown";
import { Toggle } from "@/components/ui/Toggle";
import { PageHeader } from "@/components/ui/PageHeader";
import { ThemeSettings } from "@/components/settings/ThemeSettings";
import { gatewayVersion, gatewayUrl, isConnected } from "@/lib/gateway";
import { formatVersion } from "@/lib/session-utils";
import { logout } from "@/lib/logout";
import {
  fontSize,
  fontFamily,
  timeFormat,
  newChatSettings,
  appMode,
  isMultiChatMode,
  FONT_SIZE_OPTIONS,
  FONT_FAMILY_OPTIONS,
  TIME_FORMAT_OPTIONS,
  resetToDefaults,
  type FontSize,
  type FontFamily,
  type TimeFormat,
} from "@/signals/settings";
import { agentOptions } from "@/signals/agents";
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
      <div class="p-3 sm:p-4 border-b border-[var(--color-border)]">
        <h2 class="text-base sm:text-lg font-semibold text-[var(--color-text-primary)]">
          {t(titleKey)}
        </h2>
      </div>
      <div class="p-3 sm:p-4">{children}</div>
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
    <div
      class={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 ${disabled ? "opacity-50" : ""}`}
    >
      <div class="flex-1 min-w-0">
        <label class="text-sm font-medium text-[var(--color-text-primary)]">{t(labelKey)}</label>
        <p class="text-xs text-[var(--color-text-muted)] mt-0.5">{t(descriptionKey)}</p>
      </div>
      <div class="flex-shrink-0">{children}</div>
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
    <div class="flex flex-col sm:flex-row sm:justify-between text-sm gap-0.5 sm:gap-2">
      <span class="text-[var(--color-text-muted)]">{label}</span>
      <span
        class={`text-[var(--color-text-primary)] ${truncate ? "truncate max-w-full sm:max-w-[200px]" : ""}`}
      >
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
    <ViewErrorBoundary viewName={t("nav.settings")}>
      <div class="flex-1 overflow-y-auto p-4 sm:p-6">
        <div class="max-w-5xl mx-auto space-y-4 sm:space-y-6">
          <PageHeader title={t("nav.settings")} subtitle={t("settings.description")} />

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
                  width="180px"
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
                  width="180px"
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
                  width="180px"
                />
              </SettingRow>
            </div>
          </SettingsSection>

          {/* App Mode Section */}
          <SettingsSection titleKey="settings.appMode.title">
            <SettingRow
              labelKey="settings.appMode.multiChat"
              descriptionKey="settings.appMode.multiChatDescription"
            >
              <Toggle
                checked={appMode.value === "multi"}
                onChange={(checked) => {
                  appMode.value = checked ? "multi" : "single";
                }}
              />
            </SettingRow>
          </SettingsSection>

          {/* New Chat Section - only in multi-chat mode */}
          {isMultiChatMode.value && (
            <SettingsSection titleKey="settings.newChat.title">
              <div class="space-y-6">
                <SettingRow
                  labelKey="settings.newChat.useDefaults"
                  descriptionKey="settings.newChat.useDefaultsDescription"
                >
                  <Toggle
                    checked={newChatSettings.value.useDefaults}
                    onChange={(checked) => {
                      newChatSettings.value = { ...newChatSettings.value, useDefaults: checked };
                    }}
                  />
                </SettingRow>

                <SettingRow
                  labelKey="settings.newChat.defaultAgent"
                  descriptionKey="settings.newChat.defaultAgentDescription"
                >
                  <Dropdown
                    value={newChatSettings.value.defaultAgentId}
                    onChange={(value) => {
                      newChatSettings.value = { ...newChatSettings.value, defaultAgentId: value };
                    }}
                    options={agentOptions.value}
                    size="sm"
                    width="180px"
                  />
                </SettingRow>
              </div>
            </SettingsSection>
          )}

          {/* About Section */}
          <SettingsSection titleKey="settings.about.title">
            <div class="space-y-3">
              <InfoRow label={t("settings.about.cove")} value={`v${APP_VERSION}`} />
              {gatewayVersion.value && (
                <InfoRow
                  label={t("settings.about.gateway")}
                  value={formatVersion(gatewayVersion.value)}
                />
              )}
              {gatewayUrl.value && (
                <InfoRow label={t("settings.about.gatewayUrl")} value={gatewayUrl.value} truncate />
              )}
            </div>
          </SettingsSection>

          {/* Reset to Defaults */}
          <SettingsSection titleKey="settings.data.title">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p class="text-sm text-[var(--color-text-muted)]">
                {t("settings.data.resetDefaultsDescription")}
              </p>
              <Button variant="secondary" onClick={() => resetToDefaults()} class="flex-shrink-0">
                {t("settings.data.resetDefaults")}
              </Button>
            </div>
          </SettingsSection>

          {/* Account Section */}
          {isConnected.value && (
            <SettingsSection titleKey="settings.account.title">
              <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p class="text-sm text-[var(--color-text-primary)]">
                  {t("settings.account.logoutDescription")}
                </p>
                <Button variant="secondary" onClick={() => logout()} class="flex-shrink-0">
                  {t("actions.logout")}
                </Button>
              </div>
            </SettingsSection>
          )}
        </div>
      </div>
    </ViewErrorBoundary>
  );
}
