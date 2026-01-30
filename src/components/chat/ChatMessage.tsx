/**
 * ChatMessage
 *
 * Single message bubble with role-based styling.
 */

import type { Message } from "@/types/messages";
import { MessageContent } from "./MessageContent";
import { ToolCallList } from "./ToolCallList";
import { formatRelativeTime } from "@/lib/i18n";

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}

export function ChatMessage({ message, isStreaming = false }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const isAssistant = message.role === "assistant";

  return (
    <div class={`flex ${isUser ? "justify-end" : "justify-start"}`} role="listitem">
      <div
        class={`
          max-w-[85%] rounded-3xl shadow-soft-sm
          transition-all duration-200 ease-out
          ${
            isUser
              ? "bg-[var(--color-accent)] text-white px-5 py-3.5 rounded-br-lg hover:shadow-soft"
              : isSystem
                ? "bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] px-4 py-2.5 text-sm italic rounded-2xl"
                : "bg-[var(--color-bg-surface)] border border-[var(--color-border)] px-5 py-3.5 rounded-bl-lg hover:shadow-soft"
          }
        `}
      >
        {/* Message content */}
        <div class={isUser ? "text-white" : ""}>
          <MessageContent content={message.content} isStreaming={isStreaming} />
        </div>

        {/* Tool calls (only for assistant messages) */}
        {isAssistant && message.toolCalls && message.toolCalls.length > 0 && (
          <div class="mt-3 pt-3 border-t border-[var(--color-border)]">
            <ToolCallList toolCalls={message.toolCalls} />
          </div>
        )}

        {/* Timestamp */}
        {message.timestamp && !isStreaming && (
          <div
            class={`
              mt-2 text-xs
              ${isUser ? "text-white/70" : "text-[var(--color-text-muted)]"}
            `}
          >
            {formatRelativeTime(new Date(message.timestamp))}
          </div>
        )}
      </div>
    </div>
  );
}
