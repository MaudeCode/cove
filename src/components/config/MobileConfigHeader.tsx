/**
 * MobileConfigHeader
 *
 * Header for mobile config navigation with back button and breadcrumb.
 */

import type { Signal } from "@preact/signals";
import { t } from "@/lib/i18n";
import { IconButton } from "@/components/ui/IconButton";
import { ChevronLeft, Save, RotateCcw } from "lucide-preact";
import type { ConfigUiHints } from "@/types/config";
import { humanize } from "@/lib/config/schema-utils";

interface MobileConfigHeaderProps {
  selectedPath: Signal<(string | number)[]>;
  uiHints: Signal<ConfigUiHints>;
  isDirty: boolean;
  canSave: boolean;
  isSaving: boolean;
  onSave: () => void;
  onReset: () => void;
  onBack?: () => void;
  showBack?: boolean;
}

export function MobileConfigHeader({
  selectedPath,
  uiHints,
  isDirty,
  canSave,
  isSaving,
  onSave,
  onReset,
  onBack,
  showBack,
}: MobileConfigHeaderProps) {
  const path = selectedPath.value;
  const hints = uiHints.value;
  const canGoBack = showBack ?? path.length > 0;

  // Build title from current path
  const getTitle = (): string => {
    if (path.length === 0) return t("config.title");

    const lastSegment = path[path.length - 1];
    const pathKey = path.join(".");
    const hint = hints[pathKey];

    if (hint?.label) return hint.label;
    return humanize(lastSegment);
  };

  // Build parent breadcrumb
  const getParentBreadcrumb = (): string | null => {
    if (path.length <= 1) return null;

    const parentPath = path.slice(0, -1);
    return parentPath
      .map((segment, i) => {
        const subPath = path.slice(0, i + 1);
        const hint = hints[subPath.join(".")];
        return hint?.label ?? humanize(segment);
      })
      .join(" › ");
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (path.length > 0) {
      selectedPath.value = path.slice(0, -1);
    }
  };

  const title = getTitle();
  const parentBreadcrumb = getParentBreadcrumb();

  return (
    <div class="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)]">
      {/* Back button */}
      {canGoBack && (
        <IconButton
          icon={<ChevronLeft size={20} />}
          onClick={handleBack}
          label={t("actions.back")}
          size="sm"
          variant="ghost"
        />
      )}

      {/* Title area */}
      <div class="flex-1 min-w-0">
        {parentBreadcrumb && (
          <div class="text-xs text-[var(--color-text-muted)] truncate">{parentBreadcrumb}</div>
        )}
        <h1 class="text-lg font-semibold text-[var(--color-text-primary)] truncate">{title}</h1>
      </div>

      {/* Actions */}
      <div class="flex items-center gap-1">
        {isDirty && (
          <>
            <IconButton
              icon={<RotateCcw size={18} />}
              onClick={onReset}
              label={t("config.reset")}
              size="sm"
              variant="ghost"
            />
            <IconButton
              icon={<Save size={18} />}
              onClick={onSave}
              disabled={!canSave}
              label={isSaving ? t("config.saving") : t("config.save")}
              size="sm"
              variant="ghost"
              class={canSave ? "text-[var(--color-accent)]" : ""}
            />
          </>
        )}
      </div>
    </div>
  );
}
