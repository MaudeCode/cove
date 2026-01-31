/**
 * ConnectionBanner
 *
 * Shows connection status when disconnected or reconnecting.
 */

import { t } from "@/lib/i18n";
import { connectionState, reconnectAttempt } from "@/lib/gateway";
import { hasQueuedMessages, messageQueue } from "@/signals/chat";

export function ConnectionBanner() {
  const state = connectionState.value;

  // Only show when disconnected or reconnecting (not during connecting/authenticating)
  if (state === "connected" || state === "connecting" || state === "authenticating") {
    return null;
  }

  const isReconnecting = state === "reconnecting";
  const queuedCount = messageQueue.value.length;

  return (
    <div
      class={`
        px-4 py-2 text-sm flex items-center justify-center gap-2
        animate-[fade-in_150ms_ease-out_100ms_forwards] opacity-0
        ${isReconnecting ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-red-500/10 text-red-600 dark:text-red-400"}
      `}
      role="alert"
    >
      {/* Status icon */}
      <span class="flex-shrink-0">
        {isReconnecting ? (
          <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            />
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        )}
      </span>

      {/* Message */}
      <span>
        {isReconnecting ? (
          <>
            {t("connection.reconnecting")}
            {reconnectAttempt.value > 1 && (
              <span class="text-xs opacity-75 ml-1">(attempt {reconnectAttempt.value})</span>
            )}
          </>
        ) : (
          t("connection.disconnected")
        )}
      </span>

      {/* Queued messages indicator */}
      {hasQueuedMessages.value && (
        <span class="text-xs opacity-75">
          • {queuedCount} {queuedCount === 1 ? "message" : "messages"} queued
        </span>
      )}
    </div>
  );
}
