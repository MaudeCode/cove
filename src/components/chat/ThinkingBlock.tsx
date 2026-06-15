/**
 * ThinkingBlock
 *
 * Collapsible block for displaying assistant thinking/reasoning content.
 */

import { useState } from "preact/hooks";
import { MessageContent } from "./MessageContent";
import { ChevronRight, ChevronDown, Brain } from "lucide-preact";
import { t } from "@/lib/i18n";
import { dispatchChatContentToggle } from "@/lib/chat-scroll";

interface ThinkingBlockProps {
  /** The thinking/reasoning content (markdown) */
  content: string;
}

export function ThinkingBlock({ content }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Estimate thinking duration based on content length (rough heuristic)
  // In the future, this could come from actual timing data
  const estimatedSeconds = Math.max(1, Math.round(content.length / 500));
  const durationText = t("chat.thinkingBlock.secondShort", { count: estimatedSeconds });
  const label = isExpanded
    ? t("common.thinking")
    : t("chat.thinkingBlock.thoughtFor", { duration: durationText });

  return (
    <div class="thinking-block min-w-0 space-y-2 text-[var(--color-text-muted)]">
      <button
        type="button"
        onClick={(event) => {
          dispatchChatContentToggle(event.currentTarget);
          setIsExpanded(!isExpanded);
        }}
        aria-expanded={isExpanded}
        aria-label={
          isExpanded ? t("chat.thinkingBlock.collapseLabel") : t("chat.thinkingBlock.expandLabel")
        }
        class="group flex min-h-8 w-full min-w-0 items-center gap-2 text-left text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
      >
        <Brain class="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        <span class="truncate">{label}</span>
        {isExpanded ? (
          <ChevronDown
            class="w-4 h-4 flex-shrink-0 text-[var(--color-text-muted)]"
            aria-hidden="true"
          />
        ) : (
          <ChevronRight
            class="w-4 h-4 flex-shrink-0 text-[var(--color-text-muted)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            aria-hidden="true"
          />
        )}
      </button>

      {isExpanded && (
        <div class="min-w-0 pl-6">
          <div class="min-w-0 overflow-hidden rounded-md bg-[var(--color-bg-secondary)] p-3 text-sm text-[var(--color-text-secondary)]">
            <MessageContent content={content} />
          </div>
        </div>
      )}
    </div>
  );
}
