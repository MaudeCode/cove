/**
 * ConfigDetailPanel
 *
 * Detail panel showing the selected config section's fields.
 */

import type { Signal } from "@preact/signals";
import { t } from "@/lib/i18n";
import { Settings2 } from "lucide-preact";
import type { JsonSchema, ConfigUiHints } from "@/types/config";
import { humanize, getSchemaAtPath, getValueAtPath } from "@/lib/config/schema-utils";
import { SECTION_ICONS } from "@/lib/config/section-icons";
import { ConfigNode } from "./ConfigNode";

interface ConfigDetailPanelProps {
  selectedPath: Signal<(string | number)[]>;
  schema: Signal<JsonSchema | null>;
  draftConfig: Signal<Record<string, unknown>>;
  uiHints: Signal<ConfigUiHints>;
  /** When true, skip rendering nav-worthy children (for mobile "General" view) */
  skipNavWorthy?: boolean;
}

export function ConfigDetailPanel({
  selectedPath,
  schema,
  draftConfig,
  uiHints,
  skipNavWorthy = false,
}: ConfigDetailPanelProps) {
  const path = selectedPath.value;
  const schemaValue = schema.value;
  const configValue = draftConfig.value;
  const hintsValue = uiHints.value;

  if (!schemaValue || path.length === 0) {
    return (
      <div class="flex-1 flex items-center justify-center text-[var(--color-text-muted)]">
        <div class="text-center">
          <Settings2 class="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>{t("config.selectSection")}</p>
        </div>
      </div>
    );
  }

  // Navigate to the selected schema node
  const currentSchema = getSchemaAtPath(schemaValue, path);
  const currentValue = getValueAtPath(configValue, path);

  if (!currentSchema) {
    return (
      <div class="flex-1 p-6 text-[var(--color-text-muted)]">
        <p>{t("config.schemaNotFound", { path: path.join(" › ") })}</p>
      </div>
    );
  }

  // Build breadcrumb parts
  const breadcrumbParts = path.map((segment, i) => {
    const subPath = path.slice(0, i + 1);
    const hint = hintsValue[subPath.join(".")];
    return hint?.label ?? humanize(segment);
  });

  // Get the section title (last part) and parent path
  const sectionTitle = breadcrumbParts[breadcrumbParts.length - 1];
  const parentPath = breadcrumbParts.slice(0, -1);

  // Get section description from hint or schema
  const pathKey = path.join(".");
  const sectionHint = hintsValue[pathKey];
  const sectionHelp = sectionHint?.help ?? currentSchema.description;

  // Get icon for top-level sections
  const topLevelKey = String(path[0]);
  const SectionIcon = SECTION_ICONS[topLevelKey];

  return (
    <div class="flex-1 overflow-y-auto">
      {/* Header - hidden on mobile since MobileConfigHeader shows it */}
      <div class="hidden md:block px-4 sm:px-8 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]">
        {/* Parent breadcrumb (if nested) */}
        {parentPath.length > 0 && (
          <div class="text-xs text-[var(--color-text-muted)] mb-1.5">{parentPath.join(" › ")}</div>
        )}

        {/* Section title */}
        <div class="flex items-center gap-3">
          {SectionIcon && path.length === 1 && (
            <SectionIcon class="w-6 h-6 text-[var(--color-accent)] opacity-80" />
          )}
          <h2 class="text-xl font-semibold text-[var(--color-text-primary)]">{sectionTitle}</h2>
        </div>

        {/* Section description */}
        {sectionHelp && (
          <p class="text-sm text-[var(--color-text-muted)] mt-2 max-w-2xl leading-relaxed">
            {sectionHelp}
          </p>
        )}
      </div>

      {/* Description on mobile (title is in MobileConfigHeader) */}
      {sectionHelp && (
        <div class="md:hidden px-4 pt-3 pb-2 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]">
          <p class="text-sm text-[var(--color-text-muted)] leading-relaxed">{sectionHelp}</p>
        </div>
      )}

      {/* Content */}
      <div class="px-4 sm:px-8 py-4 sm:py-6 max-w-4xl">
        <ConfigNode
          schema={currentSchema}
          value={currentValue}
          path={path}
          hints={hintsValue}
          level={0}
          showLabel={false}
          isDetailView
          skipNavWorthy={skipNavWorthy}
        />
      </div>
    </div>
  );
}
