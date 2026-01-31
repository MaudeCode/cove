/**
 * CollapsedMessage
 *
 * Collapsed display for compaction summaries.
 */

import { useState } from "preact/hooks";
import type { Message } from "@/types/messages";
import { ChevronDownIcon } from "@/components/ui";
import { t } from "@/lib/i18n";

interface CollapsedMessageProps {
  messages: Message[];
  /** Message type - currently only compaction is supported */
  type: "compaction";
}

export function CollapsedMessage({ messages, type: _type }: CollapsedMessageProps) {
  const [expanded, setExpanded] = useState(false);

  if (messages.length === 0) return null;

  const summary = messages[0]?.content ?? "";

  return (
    <div class="rounded-lg border bg-[var(--color-warning)]/5 border-[var(--color-warning)]/20 overflow-hidden">
      {/* Collapsed header - always visible */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
      >
        <span>📦</span>
        <span class="flex-1 text-left">{t("chat.conversationCompacted")}</span>
        <ChevronDownIcon open={expanded} class="w-4 h-4" />
      </button>

      {/* Expanded content */}
      {expanded && (
        <div class="border-t border-[var(--color-border)] px-3 py-2">
          <div class="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap max-h-[400px] overflow-y-auto">
            {summary}
          </div>
        </div>
      )}
    </div>
  );
}
