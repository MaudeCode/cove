/**
 * ConfigSection
 *
 * Collapsible section containing related config fields.
 */

import { t } from "@/lib/i18n";
import { Card } from "@/components/ui/Card";
import { ChevronDown, ChevronRight } from "lucide-preact";
import type { ConfigSection as SectionType } from "@/types/config";
import { ConfigField } from "./ConfigField";

interface ConfigSectionProps {
  section: SectionType;
  isExpanded: boolean;
  onToggle: () => void;
}

export function ConfigSection({ section, isExpanded, onToggle }: ConfigSectionProps) {
  return (
    <Card padding="none">
      {/* Header */}
      <button
        type="button"
        class="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-bg-tertiary)] text-left"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-label={t("accessibility.expandSection") + ": " + section.label}
      >
        <span class="text-[var(--color-text-muted)]">
          {isExpanded ? <ChevronDown class="w-5 h-5" /> : <ChevronRight class="w-5 h-5" />}
        </span>
        <span class="font-medium">{section.label}</span>
        <span class="text-sm text-[var(--color-text-muted)]">({section.fields.length})</span>
      </button>

      {/* Content */}
      {isExpanded && (
        <div class="border-t border-[var(--color-border)] px-4 py-4">
          <div class="space-y-6">
            {section.fields.map((field) => (
              <ConfigField key={field.key} field={field} />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
