/**
 * ChatMessage
 *
 * Single message bubble with role-based styling.
 * Handles sending, sent, and failed states for user messages.
 */

import type { Message } from "@/types/messages";
import { MessageContent } from "./MessageContent";
import { ToolCallList } from "./ToolCallList";
import { formatRelativeTime, t } from "@/lib/i18n";
import { retryMessage } from "@/lib/chat";

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}

export function ChatMessage({ message, isStreaming = false }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const isAssistant = message.role === "assistant";

  const isSending = message.status === "sending";
  const isFailed = message.status === "failed";

  const handleRetry = () => {
    if (message.id) {
      retryMessage(message.id);
    }
  };

  return (
    <div class={`flex ${isUser ? "justify-end" : "justify-start"}`} role="listitem">
      <div
        class={`
          max-w-[85%] rounded-3xl shadow-soft-sm
          transition-all duration-200 ease-out
          ${
            isUser
              ? isFailed
                ? "bg-red-500/80 text-white px-5 py-3.5 rounded-br-lg"
                : isSending
                  ? "bg-[var(--color-accent)]/70 text-white px-5 py-3.5 rounded-br-lg"
                  : "bg-[var(--color-accent)] text-white px-5 py-3.5 rounded-br-lg hover:shadow-soft"
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

        {/* Status footer for user messages */}
        {isUser && (
          <div class="mt-2 text-xs text-white/70 flex items-center justify-end gap-2">
            {isSending && (
              <>
                <SendingIcon />
                <span>{t("connection.messageSending")}</span>
              </>
            )}
            {isFailed && (
              <button
                onClick={handleRetry}
                class="flex items-center gap-1 hover:text-white transition-colors"
                aria-label={t("actions.retry")}
              >
                <FailedIcon />
                <span>{t("connection.messageFailed")}</span>
              </button>
            )}
            {!isSending && !isFailed && message.timestamp && !isStreaming && (
              <span>{formatRelativeTime(new Date(message.timestamp))}</span>
            )}
          </div>
        )}

        {/* Timestamp for non-user messages */}
        {!isUser && message.timestamp && !isStreaming && (
          <div class="mt-2 text-xs text-[var(--color-text-muted)]">
            {formatRelativeTime(new Date(message.timestamp))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Icons
// ============================================

function SendingIcon() {
  return (
    <svg class="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function FailedIcon() {
  return (
    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
