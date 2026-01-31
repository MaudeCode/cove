/**
 * UserMessage
 *
 * User message with status indicators and retry functionality.
 */

import { Clock, AlertCircle, RefreshCw } from "lucide-preact";
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
  const isQueued = message.status === "queued";
  const isSending = message.status === "sending";
  const isFailed = message.status === "failed";
  const isPending = isQueued || isSending;

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
          {isQueued ? (
            <span class="flex items-center gap-1 text-[var(--color-warning)]">
              <QueueIcon />
              Queued
            </span>
          ) : isSending ? (
            <span class="flex items-center gap-1">
              <LoadingDots />
              Sending
            </span>
          ) : isFailed ? (
            <span class="flex items-center gap-1 text-[var(--color-error)]">
              <FailedIcon />
              Failed
            </span>
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
              : isPending
                ? "bg-[var(--color-bg-secondary)] border border-[var(--color-border)] opacity-80"
                : "bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20"
          }
        `}
      >
        <div class="text-[var(--color-text-primary)]">
          <MessageContent content={message.content} />
        </div>

        {/* Retry button for failed messages */}
        {isFailed && (
          <div class="mt-2 pt-2 border-t border-[var(--color-error)]/20">
            <button
              onClick={handleRetry}
              class="px-3 py-1.5 rounded-lg text-xs font-medium
                bg-[var(--color-error)]/10 text-[var(--color-error)]
                hover:bg-[var(--color-error)]/20
                active:scale-95 transition-all duration-150
                flex items-center gap-1.5"
            >
              <RetryIcon />
              {t("actions.retry")}
            </button>
          </div>
        )}
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

function QueueIcon() {
  return <Clock class="w-3 h-3" aria-hidden="true" />;
}

function FailedIcon() {
  return <AlertCircle class="w-3 h-3" aria-hidden="true" />;
}

function RetryIcon() {
  return <RefreshCw class="w-3 h-3" aria-hidden="true" />;
}
