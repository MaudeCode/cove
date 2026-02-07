/**
 * LogLine Component
 *
 * Renders a single log entry with expandable fields for JSON logs.
 */

import { t } from "@/lib/i18n";
import { ChevronRight } from "lucide-preact";
import type { ParsedLogLine } from "./log-parser";
import { levelIcons, levelColors, formatLogTimestamp } from "./constants";

interface LogLineProps {
  line: ParsedLogLine;
  expanded: boolean;
  onToggle: () => void;
}

export function LogLine({ line, expanded, onToggle }: LogLineProps) {
  const Icon = line.level ? levelIcons[line.level] : undefined;
  const iconColor = line.level ? levelColors[line.level] : "text-[var(--color-text-muted)]";
  const displayTime = formatLogTimestamp(line.timestamp);

  const hasFields = line.fields && Object.keys(line.fields).length > 0;

  return (
    <div class="border-b border-[var(--color-border)]/50 last:border-0">
      <button
        type="button"
        onClick={onToggle}
        disabled={!hasFields}
        aria-expanded={hasFields ? expanded : undefined}
        aria-label={
          hasFields ? t("logs.expandLine", { message: line.message.slice(0, 50) }) : undefined
        }
        class="w-full text-left py-2 px-3 hover:bg-[var(--color-bg-hover)] flex items-start gap-2 font-mono text-xs disabled:cursor-default"
      >
        {hasFields ? (
          <ChevronRight
            size={12}
            class={`mt-0.5 flex-shrink-0 text-[var(--color-text-muted)] transition-transform ${expanded ? "rotate-90" : ""}`}
          />
        ) : (
          <span class="w-3 flex-shrink-0" />
        )}
        {Icon && <Icon size={14} class={`mt-0.5 flex-shrink-0 ${iconColor}`} />}
        {displayTime && (
          <span class="text-[var(--color-text-muted)] flex-shrink-0">{displayTime}</span>
        )}
        <span class="flex-1 text-[var(--color-text-primary)] truncate" title={line.message}>
          {line.message}
        </span>
      </button>

      {expanded && hasFields && line.fields && (
        <div class="pb-3 px-3 ml-7 space-y-2">
          {/* Full message */}
          {line.message && (
            <div class="text-xs font-mono">
              <span class="text-[var(--color-accent)]">message</span>
              <div class="text-[var(--color-text-primary)] mt-1 whitespace-pre-wrap break-all">
                {line.message}
              </div>
            </div>
          )}
          {/* Fields */}
          <div class="space-y-1 pt-1 border-t border-[var(--color-border)]/30">
            {Object.entries(line.fields).map(([key, value]) => (
              <div key={key} class="flex gap-2 text-xs font-mono">
                <span class="text-[var(--color-accent)] flex-shrink-0">{key}</span>
                <span class="text-[var(--color-text-secondary)] break-all">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
