/**
 * CompactionDivider
 *
 * A horizontal divider showing where compaction occurred in the conversation history.
 * Optionally expandable to show the compaction summary text if available.
 */

import { useState } from "preact/hooks";
import { Scissors, ChevronDown, ChevronUp } from "lucide-preact";
import { t, formatTimestamp } from "@/lib/i18n";
import type { Message } from "@/types/messages";

interface CompactionDividerProps {
  /** The compaction message(s) — may contain summary text */
  messages: Message[];
}

export function CompactionDivider({ messages }: CompactionDividerProps) {
  const [expanded, setExpanded] = useState(false);
  const message = messages[0];
  const hasSummary =
    message?.content &&
    message.content.trim().length > 0 &&
    message.content.toLowerCase() !== "compaction";

  const labelClasses =
    "flex items-center gap-1.5 px-3 py-1 text-xs tracking-wide uppercase rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)]";
  const timestamp = message?.timestamp ? formatTimestamp(message.timestamp) : undefined;

  return (
    <div class="my-4">
      {/* Divider line with label */}
      <div class="flex items-center gap-3 select-none" role="separator">
        <div class="flex-1 h-px bg-[var(--color-border)]" />
        {hasSummary ? (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            class={`${labelClasses} cursor-pointer hover:text-[var(--color-text-secondary)] hover:border-[var(--color-text-muted)] transition-colors`}
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
          <span class={labelClasses} title={timestamp}>
            <Scissors class="w-3 h-3" aria-hidden="true" />
            <span>{t("chat.compactionLabel")}</span>
          </span>
        )}
        <div class="flex-1 h-px bg-[var(--color-border)]" />
      </div>

      {/* Expandable summary */}
      {expanded && hasSummary && (
        <div class="mt-2 mx-8 px-3 py-2 text-sm text-[var(--color-text-secondary)] bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] whitespace-pre-wrap max-h-[300px] overflow-y-auto">
          {message.content}
        </div>
      )}
    </div>
  );
}
