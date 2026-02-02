/**
 * ConfigObjectNode
 *
 * Renders an object schema node as a collapsible section.
 */

import { useState } from "preact/hooks";
import { ChevronDown, ChevronRight } from "lucide-preact";
import type { JsonSchema, ConfigUiHints } from "@/types/config";
import { ConfigNode } from "./ConfigNode";

interface ObjectNodeProps {
  schema: JsonSchema;
  value: Record<string, unknown> | null;
  path: (string | number)[];
  hints: ConfigUiHints;
  level: number;
  label: string;
  help?: string;
  isDetailView?: boolean;
}

export function ObjectNode({
  schema,
  value,
  path,
  hints,
  level,
  label,
  help,
  isDetailView = false,
}: ObjectNodeProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2 || isDetailView);
  const properties = schema.properties ?? {};
  const propertyKeys = Object.keys(properties);
  const actualValue = value ?? {};

  // In detail view at level 0, render fields directly (no wrapper)
  if (isDetailView && level === 0) {
    return (
      <div class="space-y-2">
        {help && <p class="text-sm text-[var(--color-text-muted)] mb-4">{help}</p>}
        {propertyKeys.map((key) => (
          <ConfigNode
            key={key}
            schema={properties[key]}
            value={actualValue[key]}
            path={[...path, key]}
            hints={hints}
            level={level + 1}
          />
        ))}
      </div>
    );
  }

  // Nested object: collapsible section with subtle styling
  return (
    <div class="mt-6 first:mt-3">
      <button
        type="button"
        class="flex items-center gap-2 py-2 text-left group"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <span class="text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)] transition-colors">
          {isExpanded ? <ChevronDown class="w-4 h-4" /> : <ChevronRight class="w-4 h-4" />}
        </span>
        <span class="text-sm font-semibold text-[var(--color-text-primary)]">{label}</span>
        <span class="text-xs text-[var(--color-text-muted)]">({propertyKeys.length})</span>
      </button>

      {isExpanded && (
        <div class="ml-6 pl-4 border-l border-[var(--color-border)] mt-1">
          {help && (
            <p class="text-xs text-[var(--color-text-muted)] pb-2 leading-relaxed">{help}</p>
          )}
          {propertyKeys.map((key) => (
            <ConfigNode
              key={key}
              schema={properties[key]}
              value={actualValue[key]}
              path={[...path, key]}
              hints={hints}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
