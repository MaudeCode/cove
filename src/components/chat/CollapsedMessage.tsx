/**
 * CollapsedMessage
 *
 * Collapsed display for special messages (compaction summaries, cron job output).
 */

import { useState } from "preact/hooks";
import type { Message } from "@/types/messages";
import { ChevronDownIcon } from "@/components/ui";
import { t } from "@/lib/i18n";

type CollapsedType = "compaction" | "cron";

interface CollapsedMessageProps {
  messages: Message[];
  /** Message type */
  type: CollapsedType;
}

/** Configuration for each collapsed message type */
const TYPE_CONFIG: Record<CollapsedType, { icon: string; labelKey: string; bgClass: string }> = {
  compaction: {
    icon: "📦",
    labelKey: "chat.conversationCompacted",
    bgClass: "bg-[var(--color-warning)]/5 border-[var(--color-warning)]/20",
  },
  cron: {
    icon: "⏰",
    labelKey: "chat.cronJobCompleted",
    bgClass: "bg-[var(--color-text-muted)]/5 border-[var(--color-border)]",
  },
};

export function CollapsedMessage({ messages, type }: CollapsedMessageProps) {
  const [expanded, setExpanded] = useState(false);
  const config = TYPE_CONFIG[type];

  if (messages.length === 0) return null;

  const content = messages[0]?.content ?? "";
  // For cron messages, strip the [Cron] prefix for cleaner display
  const displayContent = type === "cron" ? content.replace(/^\s*\[cron\]\s*/i, "") : content;

  return (
    <div class={`rounded-lg border overflow-hidden ${config.bgClass}`}>
      {/* Collapsed header - always visible */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors cursor-pointer"
      >
        <span>{config.icon}</span>
        <span class="flex-1 text-left">{t(config.labelKey)}</span>
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
