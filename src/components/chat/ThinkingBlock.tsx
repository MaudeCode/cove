/**
 * ThinkingBlock
 *
 * Collapsible block for displaying assistant thinking/reasoning content.
 * Follows Claude.ai style: collapsed by default with "Thought for Xs" header.
 */

import { useState } from "preact/hooks";
import { MessageContent } from "./MessageContent";
import { ChevronRight, ChevronDown, Brain } from "lucide-preact";
import { t } from "@/lib/i18n";

interface ThinkingBlockProps {
  /** The thinking/reasoning content (markdown) */
  content: string;
}

export function ThinkingBlock({ content }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Estimate thinking duration based on content length (rough heuristic)
  // In the future, this could come from actual timing data
  const estimatedSeconds = Math.max(1, Math.round(content.length / 500));
  const durationText = t(
    estimatedSeconds === 1 ? "chat.thinkingBlock.second" : "chat.thinkingBlock.second_plural",
    { count: estimatedSeconds },
  );

  return (
    <div class="thinking-block border border-[var(--color-border)] rounded-lg overflow-hidden my-2">
      {/* Header - always visible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-label={
          isExpanded ? t("chat.thinkingBlock.collapseLabel") : t("chat.thinkingBlock.expandLabel")
        }
        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] transition-colors"
      >
        {/* Expand/collapse icon */}
        {isExpanded ? (
          <ChevronDown class="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        ) : (
          <ChevronRight class="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        )}

        {/* Brain icon */}
        <Brain class="w-4 h-4 flex-shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />

        {/* Label */}
        <span class="font-medium">
          {isExpanded
            ? t("chat.thinkingBlock.thinking")
            : t("chat.thinkingBlock.thoughtFor", { duration: durationText })}
        </span>
      </button>

      {/* Content - only shown when expanded */}
      {isExpanded && (
        <div class="px-3 pb-3 border-t border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
          <div class="pt-3 text-sm text-[var(--color-text-secondary)]">
            <MessageContent content={content} />
          </div>
        </div>
      )}
    </div>
  );
}
