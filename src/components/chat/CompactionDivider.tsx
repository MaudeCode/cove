/**
 * CompactionDivider
 *
 * Inline divider for compaction events in the conversation flow.
 * Two modes:
 *   - active: spinner + "Compacting conversation..." (live, during compaction)
 *   - complete: scissors + "Compacted" with optional expandable summary
 */

import { useState } from "preact/hooks";
import { Scissors, ChevronDown, ChevronUp, Loader2 } from "lucide-preact";
import { t, formatTimestamp } from "@/lib/i18n";
import type { Message } from "@/types/messages";

interface CompactionDividerProps {
  /** The compaction message(s) — may contain summary text. Used for history-based dividers. */
  messages?: Message[];
  /** Summary text for a just-completed compaction (ephemeral, not from history). */
  summary?: string;
  /** Whether compaction is currently in progress */
  active?: boolean;
}

export function CompactionDivider({ messages, summary, active }: CompactionDividerProps) {
  const [expanded, setExpanded] = useState(false);
  const message = messages?.[0];
  // Summary can come from a Message (history) or the ephemeral summary prop (live)
  const summaryText = summary ?? message?.content;
  const hasSummary =
    !!summaryText && summaryText.trim().length > 0 && summaryText.toLowerCase() !== "compaction";

  const timestamp = message?.timestamp ? formatTimestamp(message.timestamp) : undefined;

  const baseClasses =
    "flex items-center gap-1.5 px-3 py-1 text-xs tracking-wide uppercase rounded-full border";

  if (active) {
    return (
      <div class="my-4">
        <div class="flex items-center gap-3 select-none" role="status">
          <div class="flex-1 h-px bg-[var(--color-border)]" />
          <span
            class={`${baseClasses} border-[var(--color-border)] text-[var(--color-text-muted)]`}
          >
            <Loader2 class="w-3 h-3 animate-spin" aria-hidden="true" />
            <span>{t("chat.compacting")}</span>
          </span>
          <div class="flex-1 h-px bg-[var(--color-border)]" />
        </div>
      </div>
    );
  }

  return (
    <div class="my-4">
      {/* Divider line with label */}
      <div class="flex items-center gap-3 select-none" role="separator">
        <div class="flex-1 h-px bg-[var(--color-border)]" />
        {hasSummary ? (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            class={`${baseClasses} border-[var(--color-border)] text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-text-secondary)] hover:border-[var(--color-text-muted)] transition-colors`}
            aria-label={t("chat.conversationCompacted")}
            aria-expanded={expanded}
            title={timestamp}
          >
            <Scissors class="w-3 h-3" aria-hidden="true" />
            <span>{t("chat.compactionLabel")}</span>
            {expanded ? (
              <ChevronUp class="w-3 h-3" aria-hidden="true" />
            ) : (
              <ChevronDown class="w-3 h-3" aria-hidden="true" />
            )}
          </button>
        ) : (
          <span
            class={`${baseClasses} border-[var(--color-border)] text-[var(--color-text-muted)]`}
            title={timestamp}
          >
            <Scissors class="w-3 h-3" aria-hidden="true" />
            <span>{t("chat.compactionLabel")}</span>
          </span>
        )}
        <div class="flex-1 h-px bg-[var(--color-border)]" />
      </div>

      {/* Expandable summary */}
      {expanded && hasSummary && (
        <div class="mt-2 mx-8 px-3 py-2 text-sm text-[var(--color-text-secondary)] bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] whitespace-pre-wrap max-h-[300px] overflow-y-auto">
          {summaryText}
        </div>
      )}
    </div>
  );
}
