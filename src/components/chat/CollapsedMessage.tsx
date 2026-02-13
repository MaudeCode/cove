/**
 * CollapsedMessage
 *
 * Collapsed display for special messages (cron job output).
 */

import { useState } from "preact/hooks";
import type { Message } from "@/types/messages";
import { ChevronDownIcon } from "@/components/ui/icons";
import { t } from "@/lib/i18n";

interface CollapsedMessageProps {
  messages: Message[];
}

export function CollapsedMessage({ messages }: CollapsedMessageProps) {
  const [expanded, setExpanded] = useState(false);

  if (messages.length === 0) return null;

  const content = messages[0]?.content ?? "";
  // Strip the [Cron] prefix for cleaner display
  const displayContent = content.replace(/^\s*\[cron\]\s*/i, "");

  return (
    <div class="rounded-lg border overflow-hidden bg-[var(--color-text-muted)]/5 border-[var(--color-border)]">
      {/* Collapsed header - always visible */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors cursor-pointer"
        aria-expanded={expanded}
      >
        <span>⏰</span>
        <span class="flex-1 text-left">{t("chat.cronJobCompleted")}</span>
        <ChevronDownIcon open={expanded} class="w-4 h-4" />
      </button>

      {/* Expanded content */}
      {expanded && (
        <div class="border-t border-[var(--color-border)] px-3 py-2">
          <div class="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap max-h-[400px] overflow-y-auto">
            {displayContent}
          </div>
        </div>
      )}
    </div>
  );
}
