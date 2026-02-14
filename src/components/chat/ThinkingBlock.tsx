/**
 * ThinkingBlock
 *
 * Collapsible block for displaying assistant thinking/reasoning content.
 * Follows Claude.ai style: collapsed by default with "Thought for Xs" header.
 */

import { useState } from "preact/hooks";
import { MessageContent } from "./MessageContent";
import { ChevronRight, ChevronDown, Brain } from "lucide-preact";

interface ThinkingBlockProps {
  /** The thinking/reasoning content (markdown) */
  content: string;
  /** Message timestamp for calculating thinking duration */
  timestamp?: number;
}

export function ThinkingBlock({ content, timestamp: _timestamp }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Estimate thinking duration based on content length (rough heuristic)
  // In the future, this could come from actual timing data
  const estimatedSeconds = Math.max(1, Math.round(content.length / 500));
  const durationText = estimatedSeconds === 1 ? "1 second" : `${estimatedSeconds} seconds`;

  return (
    <div class="thinking-block border border-[var(--color-border)] rounded-lg overflow-hidden my-2">
      {/* Header - always visible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] transition-colors"
      >
        {/* Expand/collapse icon */}
        {isExpanded ? (
          <ChevronDown class="w-4 h-4 flex-shrink-0" />
        ) : (
          <ChevronRight class="w-4 h-4 flex-shrink-0" />
        )}

        {/* Brain icon */}
        <Brain class="w-4 h-4 flex-shrink-0 text-[var(--color-text-muted)]" />

        {/* Label */}
        <span class="font-medium">{isExpanded ? "Thinking" : `Thought for ~${durationText}`}</span>
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
