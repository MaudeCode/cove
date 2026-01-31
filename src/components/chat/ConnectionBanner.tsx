/**
 * ConnectionBanner
 *
 * Shows connection status when disconnected or reconnecting.
 */

import { Loader2, AlertTriangle } from "lucide-preact";
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
          <Loader2 class="w-4 h-4 animate-spin" aria-hidden="true" />
        ) : (
          <AlertTriangle class="w-4 h-4" aria-hidden="true" />
        )}
      </span>

      {/* Message */}
      <span>
        {isReconnecting
          ? reconnectAttempt.value > 1
            ? t("connection.reconnectingAttempt", { count: reconnectAttempt.value })
            : t("connection.reconnecting")
          : t("connection.disconnected")}
      </span>

      {/* Queued messages indicator */}
      {hasQueuedMessages.value && (
        <span class="text-xs opacity-75">
          • {t("connection.messagesQueued", { count: queuedCount })}
        </span>
      )}
    </div>
  );
}
