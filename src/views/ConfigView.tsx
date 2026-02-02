/**
 * ConfigView
 *
 * Schema-driven configuration editor.
 * Route: /config
 */

import { useEffect } from "preact/hooks";
import { t } from "@/lib/i18n";
import { isConnected } from "@/lib/gateway";
import { toast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { HintBox } from "@/components/ui/HintBox";
import { Toggle } from "@/components/ui/Toggle";
import { RefreshCw, Search, Save, RotateCcw, Settings2 } from "lucide-preact";
import type { RouteProps } from "@/types/routes";
import {
  isLoading,
  error,
  isSaving,
  schema,
  uiHints,
  draftConfig,
  searchQuery,
  showAdvanced,
  isDirty,
  canSave,
  schemaVersion,
  configPath,
  loadConfig,
  resetDraft,
  saveConfig,
} from "@/signals/config";
import { ConfigNode } from "@/components/config/ConfigNode";

// ============================================
// Main View
// ============================================

export function ConfigView(_props: RouteProps) {
  // Load config on mount
  useEffect(() => {
    if (isConnected.value && !schema.value) {
      loadConfig();
    }
  }, [isConnected.value]);

  const handleSave = async () => {
    const success = await saveConfig();
    if (success) {
      toast.success(t("config.saveSuccess"));
    } else if (error.value) {
      toast.error(error.value);
    }
  };

  const handleReset = () => {
    resetDraft();
    toast.success(t("config.reset"));
  };

  const schemaValue = schema.value;
  const hintsValue = uiHints.value;
  const configValue = draftConfig.value;

  // Get top-level properties to render
  const topLevelKeys = schemaValue?.properties ? Object.keys(schemaValue.properties) : [];

  // Filter by search if needed
  const query = searchQuery.value.toLowerCase().trim();
  const filteredKeys = query
    ? topLevelKeys.filter((key) => {
        const prop = schemaValue?.properties?.[key];
        const hint = hintsValue[key];
        const label = hint?.label ?? prop?.title ?? key;
        const help = hint?.help ?? prop?.description ?? "";
        return (
          key.toLowerCase().includes(query) ||
          label.toLowerCase().includes(query) ||
          help.toLowerCase().includes(query)
        );
      })
    : topLevelKeys;

  // Filter advanced if needed
  const displayKeys = showAdvanced.value
    ? filteredKeys
    : filteredKeys.filter((key) => {
        const hint = hintsValue[key];
        return !hint?.advanced;
      });

  // Sort by order hint
  displayKeys.sort((a, b) => {
    const orderA = hintsValue[a]?.order ?? 100;
    const orderB = hintsValue[b]?.order ?? 100;
    return orderA - orderB;
  });

  return (
    <div class="flex-1 overflow-y-auto p-6">
      <div class="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div class="flex items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold">{t("config.title")}</h1>
            <p class="text-[var(--color-text-muted)]">
              {t("config.description")}
              {schemaVersion.value && (
                <span class="ml-2 text-xs">
                  ({t("config.version", { version: schemaVersion.value })})
                </span>
              )}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <IconButton
              icon={<RefreshCw class={isLoading.value ? "animate-spin" : ""} />}
              onClick={loadConfig}
              disabled={isLoading.value}
              label={t("actions.refresh")}
            />
          </div>
        </div>

        {/* Error */}
        {error.value && <HintBox variant="error">{error.value}</HintBox>}

        {/* Loading */}
        {isLoading.value && !schemaValue && (
          <div class="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        )}

        {/* Content */}
        {!isLoading.value && schemaValue && (
          <>
            {/* Toolbar */}
            <Card>
              <div class="flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Search */}
                <div class="flex-1">
                  <Input
                    type="text"
                    placeholder={t("config.searchPlaceholder")}
                    value={searchQuery.value}
                    onInput={(e) => {
                      searchQuery.value = (e.target as HTMLInputElement).value;
                    }}
                    leftElement={<Search class="w-4 h-4" />}
                  />
                </div>

                {/* Advanced toggle */}
                <div class="flex items-center gap-3">
                  <Toggle
                    checked={showAdvanced.value}
                    onChange={(checked) => {
                      showAdvanced.value = checked;
                    }}
                    label={t("config.showAdvanced")}
                  />
                </div>

                {/* Actions */}
                <div class="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={RotateCcw}
                    onClick={handleReset}
                    disabled={!isDirty.value}
                  >
                    {t("config.reset")}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Save}
                    onClick={handleSave}
                    disabled={!canSave.value}
                  >
                    {isSaving.value ? t("config.saving") : t("config.save")}
                  </Button>
                </div>
              </div>

              {/* Dirty indicator */}
              {isDirty.value && (
                <p class="mt-3 text-sm text-[var(--color-warning)]">{t("config.unsavedChanges")}</p>
              )}
            </Card>

            {/* Config Sections */}
            {displayKeys.length === 0 ? (
              <Card>
                <div class="text-center py-8 text-[var(--color-text-muted)]">
                  <Settings2 class="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>{query ? t("config.noResults") : t("config.noFields")}</p>
                </div>
              </Card>
            ) : (
              <div class="space-y-4">
                {displayKeys.map((key) => {
                  const propSchema = schemaValue.properties?.[key];
                  if (!propSchema) return null;

                  return (
                    <ConfigNode
                      key={key}
                      schema={propSchema}
                      value={configValue[key]}
                      path={[key]}
                      hints={hintsValue}
                      level={0}
                    />
                  );
                })}
              </div>
            )}

            {/* Config path footer */}
            {configPath.value && (
              <p class="text-xs text-[var(--color-text-muted)] text-center">
                {t("config.configPath", { path: configPath.value })}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
