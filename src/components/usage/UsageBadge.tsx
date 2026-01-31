/**
 * UsageBadge
 *
 * Compact usage indicator for the TopBar.
 * Shows primary usage window (typically weekly) with a progress bar.
 * Expands to show all windows on click.
 */

import { useState, useRef } from "preact/hooks";
import { hasAnthropicUsage, anthropicUsage, primaryUsageWindow } from "@/signals/usage";
import { getUsageLevel } from "@/types/usage";
import { useClickOutside } from "@/hooks";
import type { UsageWindow } from "@/types/usage";

export function UsageBadge() {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Don't render if no Anthropic usage data
  if (!hasAnthropicUsage.value) {
    return null;
  }

  // Close on click outside
  useClickOutside(containerRef, () => setExpanded(false), expanded);

  const usage = anthropicUsage.value;
  const primary = primaryUsageWindow.value;

  if (!usage || !primary) {
    return null;
  }

  const level = getUsageLevel(primary.usedPercent);

  return (
    <div ref={containerRef} class="relative">
      {/* Compact badge */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        class="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-[var(--color-bg-surface)] transition-colors"
        aria-expanded={expanded}
        aria-label={`Anthropic usage: ${Math.round(primary.usedPercent)}% ${primary.label}`}
      >
        {/* Mini progress bar */}
        <div class="w-16 h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
          <div
            class={`h-full rounded-full transition-all ${getProgressColor(level)}`}
            style={{ width: `${Math.min(100, primary.usedPercent)}%` }}
          />
        </div>

        {/* Percentage */}
        <span class={`text-xs font-medium ${getTextColor(level)}`}>
          {Math.round(primary.usedPercent)}%
        </span>

        {/* Label */}
        <span class="text-xs text-[var(--color-text-muted)] hidden sm:inline">{primary.label}</span>
      </button>

      {/* Expanded popover */}
      {expanded && (
        <div class="absolute right-0 top-full mt-2 w-64 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg shadow-lg z-50 p-3">
          <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-medium">{usage.displayName}</span>
            {usage.plan && (
              <span class="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] px-2 py-0.5 rounded">
                {usage.plan}
              </span>
            )}
          </div>

          <div class="space-y-3">
            {usage.windows.map((window) => (
              <UsageWindowRow key={window.label} window={window} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Single usage window row in the expanded view
 */
function UsageWindowRow({ window }: { window: UsageWindow }) {
  const level = getUsageLevel(window.usedPercent);
  const resetText = window.resetAt ? formatResetTime(window.resetAt) : null;

  return (
    <div>
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs text-[var(--color-text-secondary)]">{window.label}</span>
        <span class={`text-xs font-medium ${getTextColor(level)}`}>
          {Math.round(window.usedPercent)}%
        </span>
      </div>

      {/* Progress bar */}
      <div class="w-full h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
        <div
          class={`h-full rounded-full transition-all ${getProgressColor(level)}`}
          style={{ width: `${Math.min(100, window.usedPercent)}%` }}
        />
      </div>

      {/* Reset time */}
      {resetText && (
        <div class="text-[10px] text-[var(--color-text-muted)] mt-1">Resets {resetText}</div>
      )}
    </div>
  );
}

// ============================================
// Helpers
// ============================================

function getProgressColor(level: string): string {
  switch (level) {
    case "critical":
      return "bg-[var(--color-error)]";
    case "high":
      return "bg-[var(--color-warning)]";
    case "medium":
      return "bg-[var(--color-warning)]";
    default:
      return "bg-[var(--color-success)]";
  }
}

function getTextColor(level: string): string {
  switch (level) {
    case "critical":
      return "text-[var(--color-error)]";
    case "high":
      return "text-[var(--color-warning)]";
    default:
      return "text-[var(--color-text-secondary)]";
  }
}

function formatResetTime(timestamp: number): string {
  const now = Date.now();
  const diff = timestamp - now;

  if (diff < 0) {
    return "soon";
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `in ${days}d`;
  }

  if (hours > 0) {
    return `in ${hours}h ${minutes}m`;
  }

  return `in ${minutes}m`;
}
