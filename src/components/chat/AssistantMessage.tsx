/**
 * AssistantMessage
 *
 * Assistant message with avatar, name, and tool calls inline.
 */

import type { Message } from "@/types/messages";
import { MessageContent } from "./MessageContent";
import { ToolCallList } from "./ToolCallList";
import { formatRelativeTime } from "@/lib/i18n";

interface AssistantMessageProps {
  message: Message;
  assistantName?: string;
  assistantAvatar?: string;
  isStreaming?: boolean;
}

export function AssistantMessage({
  message,
  assistantName = "Assistant",
  assistantAvatar,
  isStreaming = false,
}: AssistantMessageProps) {
  const hasToolCalls = message.toolCalls && message.toolCalls.length > 0;

  return (
    <div class="group">
      {/* Header: Avatar + Name + Timestamp */}
      <div class="flex items-center gap-2 mb-1.5">
        {/* Avatar */}
        <div class="w-6 h-6 rounded-full bg-[var(--color-bg-surface)] border border-[var(--color-border)] flex items-center justify-center text-sm">
          {assistantAvatar || "🤖"}
        </div>

        {/* Name */}
        <span class="text-sm font-medium text-[var(--color-text-primary)]">{assistantName}</span>

        {/* Timestamp */}
        {!isStreaming && message.timestamp && (
          <span class="text-xs text-[var(--color-text-muted)]">
            {formatRelativeTime(new Date(message.timestamp))}
          </span>
        )}

        {/* Streaming indicator */}
        {isStreaming && (
          <span class="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
            <StreamingDots />
          </span>
        )}
      </div>

      {/* Message Content */}
      <div class="ml-8">
        {/* Text content first */}
        {message.content && (
          <div class="prose prose-sm max-w-none text-[var(--color-text-primary)]">
            <MessageContent content={message.content} isStreaming={isStreaming} />
          </div>
        )}

        {/* Streaming cursor (after text, before tool calls) */}
        {isStreaming && !hasToolCalls && (
          <span class="inline-block w-2 h-4 bg-[var(--color-accent)] animate-pulse rounded-sm ml-0.5" />
        )}

        {/* Tool calls (after text content) */}
        {hasToolCalls && (
          <div class="mt-3">
            <ToolCallList toolCalls={message.toolCalls!} />
          </div>
        )}

        {/* Streaming cursor (after tool calls if we have them) */}
        {isStreaming && hasToolCalls && (
          <span class="inline-block w-2 h-4 bg-[var(--color-accent)] animate-pulse rounded-sm ml-0.5 mt-2" />
        )}
      </div>
    </div>
  );
}

function StreamingDots() {
  return (
    <span class="inline-flex gap-0.5">
      <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse" />
      <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse [animation-delay:150ms]" />
      <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse [animation-delay:300ms]" />
    </span>
  );
}
