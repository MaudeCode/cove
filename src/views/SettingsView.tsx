/**
 * SettingsView
 *
 * User preferences and app settings.
 */

import type { ComponentChildren } from "preact";
import { useState, useEffect } from "preact/hooks";
import { t } from "@/lib/i18n";
import { PageLayout } from "@/components/ui/PageLayout";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
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
  canvasNodeEnabled,
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
import { deviceDisplayName, setDeviceDisplayName, getDeviceIdentity } from "@/lib/device-identity";
import {
  nodeConnected,
  refreshNodeRegistration,
  startNodeConnection,
  stopNodeConnection,
} from "@/lib/node-connection";

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
// Device Settings Component
// ============================================

function CanvasNodeSettings() {
  const [defaultName, setDefaultName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  // Load device ID and set initial values
  useEffect(() => {
    getDeviceIdentity().then((identity) => {
      const autoName = `Cove Canvas (${identity.deviceId.slice(0, 8)})`;
      setDefaultName(autoName);
      setNameInput(deviceDisplayName.value ?? autoName);
    });
  }, []);

  const handleToggle = (enabled: boolean) => {
    canvasNodeEnabled.value = enabled;
    if (enabled) {
      startNodeConnection();
    } else {
      stopNodeConnection();
    }
  };

  const handleChange = (value: string) => {
    setNameInput(value);
    setIsDirty(true);
  };

  const handleBlur = () => {
    if (!isDirty) return;

    const oldName = deviceDisplayName.value;
    let newName: string | null;

    if (!nameInput.trim() || nameInput.trim() === defaultName) {
      newName = null;
      setNameInput(defaultName);
    } else {
      newName = nameInput.trim();
    }

    setDeviceDisplayName(newName);
    setIsDirty(false);

    if (newName !== oldName && nodeConnected.value) {
      refreshNodeRegistration();
    }
  };

  return (
    <>
      <SettingRow
        labelKey="settings.device.enabled"
        descriptionKey="settings.device.enabledDescription"
      >
        <Toggle checked={canvasNodeEnabled.value} onChange={handleToggle} />
      </SettingRow>

      {canvasNodeEnabled.value && (
        <SettingRow
          labelKey="settings.device.name"
          descriptionKey="settings.device.nameDescription"
        >
          <Input
            value={nameInput}
            onChange={(e) => handleChange((e.target as HTMLInputElement).value)}
            onBlur={handleBlur}
            class="w-[200px]"
          />
        </SettingRow>
      )}
    </>
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
    <PageLayout viewName={t("nav.settings")}>
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

      {/* Interface Section */}
      <SettingsSection titleKey="settings.appMode.title">
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

          {/* New Chat options - only in multi-chat mode */}
          {isMultiChatMode.value && (
            <>
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
            </>
          )}

          {/* Canvas Node */}
          <CanvasNodeSettings />
        </div>
      </SettingsSection>

      {/* About Section */}
      <SettingsSection titleKey="settings.about.title">
        <div class="space-y-4">
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

          <div class="border-t border-[var(--color-border)] pt-4 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => resetToDefaults()}>
              {t("settings.data.resetDefaults")}
            </Button>
            {isConnected.value && (
              <Button variant="secondary" onClick={() => logout()}>
                {t("actions.logout")}
              </Button>
            )}
          </div>
        </div>
      </SettingsSection>
    </PageLayout>
  );
}
