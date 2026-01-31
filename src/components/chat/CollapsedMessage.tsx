/**
 * CollapsedMessage
 *
 * Collapsed display for special messages (heartbeat, compaction).
 */

import { useState } from "preact/hooks";
import type { Message } from "@/types/messages";
import { ChatMessage } from "./ChatMessage";
import { ChevronDownIcon } from "@/components/ui";

interface CollapsedMessageProps {
  messages: Message[];
  type: "heartbeat" | "compaction";
  assistantName?: string;
  assistantAvatar?: string;
  userName?: string;
  userAvatar?: string;
}

const typeConfig = {
  heartbeat: {
    icon: "💓",
    label: "Heartbeat",
    collapsedText: (count: number) => `${count} heartbeat${count > 1 ? "s" : ""}`,
    bgColor: "bg-[var(--color-text-muted)]/5",
    borderColor: "border-[var(--color-text-muted)]/20",
  },
  compaction: {
    icon: "📦",
    label: "Compaction",
    collapsedText: () => "Conversation compacted",
    bgColor: "bg-[var(--color-warning)]/5",
    borderColor: "border-[var(--color-warning)]/20",
  },
};

export function CollapsedMessage({
  messages,
  type,
  assistantName,
  assistantAvatar,
  userName,
  userAvatar,
}: CollapsedMessageProps) {
  const [expanded, setExpanded] = useState(false);
  const config = typeConfig[type];

  if (messages.length === 0) return null;

  // For compaction, show the summary content when expanded
  const compactionSummary = type === "compaction" ? messages[0]?.content : null;

  return (
    <div class={`rounded-lg border ${config.bgColor} ${config.borderColor} overflow-hidden`}>
      {/* Collapsed header - always visible */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
      >
        <span>{config.icon}</span>
        <span class="flex-1 text-left">{config.collapsedText(messages.length)}</span>
        <ChevronDownIcon open={expanded} class="w-4 h-4" />
      </button>

      {/* Expanded content */}
      {expanded && (
        <div class="border-t border-[var(--color-border)] px-3 py-2">
          {type === "compaction" && compactionSummary ? (
            <div class="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">
              {compactionSummary}
            </div>
          ) : (
            <div class="space-y-2 opacity-60">
              {messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  assistantName={assistantName}
                  assistantAvatar={assistantAvatar}
                  userName={userName}
                  userAvatar={userAvatar}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
