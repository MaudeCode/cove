/**
 * UserMessage
 *
 * User message with subtle accent background.
 */

import type { Message } from "@/types/messages";
import { MessageContent } from "./MessageContent";
import { formatRelativeTime, t } from "@/lib/i18n";
import { retryMessage } from "@/lib/chat";

interface UserMessageProps {
  message: Message;
  userName?: string;
  userAvatar?: string;
}

export function UserMessage({ message, userName = "You", userAvatar }: UserMessageProps) {
  const isSending = message.status === "sending";
  const isFailed = message.status === "failed";

  const handleRetry = () => {
    if (message.id) {
      retryMessage(message.id);
    }
  };

  return (
    <div class="group">
      {/* Header: Avatar + Name + Timestamp */}
      <div class="flex items-center gap-2 mb-1.5">
        {/* Avatar */}
        <div class="w-6 h-6 rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center text-xs font-medium text-[var(--color-accent)]">
          {userAvatar || userName.charAt(0).toUpperCase()}
        </div>

        {/* Name */}
        <span class="text-sm font-medium text-[var(--color-text-primary)]">{userName}</span>

        {/* Timestamp or Status */}
        <span class="text-xs text-[var(--color-text-muted)]">
          {isSending ? (
            <span class="flex items-center gap-1">
              <LoadingDots />
              {t("connection.messageSending")}
            </span>
          ) : isFailed ? (
            <button
              onClick={handleRetry}
              class="text-[var(--color-error)] hover:underline flex items-center gap-1"
            >
              <FailedIcon />
              {t("actions.retry")}
            </button>
          ) : (
            formatRelativeTime(new Date(message.timestamp))
          )}
        </span>
      </div>

      {/* Message Content */}
      <div
        class={`
          ml-8 rounded-2xl px-4 py-3
          ${
            isFailed
              ? "bg-[var(--color-error)]/10 border border-[var(--color-error)]/20"
              : "bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20"
          }
        `}
      >
        <div class="text-[var(--color-text-primary)]">
          <MessageContent content={message.content} />
        </div>
      </div>
    </div>
  );
}

function LoadingDots() {
  return (
    <span class="inline-flex gap-0.5">
      <span class="w-1 h-1 rounded-full bg-current animate-pulse" />
      <span class="w-1 h-1 rounded-full bg-current animate-pulse [animation-delay:150ms]" />
      <span class="w-1 h-1 rounded-full bg-current animate-pulse [animation-delay:300ms]" />
    </span>
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
