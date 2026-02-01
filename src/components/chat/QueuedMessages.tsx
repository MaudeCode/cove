/**
 * QueuedMessages
 *
 * Displays queued messages above the chat input with ability to remove them.
 * Messages are auto-sent one at a time when the assistant stops streaming.
 */

import { messageQueue, dequeueMessage } from "@/signals/chat";
import { t } from "@/lib/i18n";
import { XIcon } from "@/components/ui/icons";

export function QueuedMessages() {
  const queue = messageQueue.value;

  if (queue.length === 0) return null;

  return (
    <div class="mb-2 space-y-2">
      <div class="text-xs text-[var(--color-text-muted)] font-medium">
        {t("chat.queuedMessages", { count: queue.length })}
      </div>
      <div class="space-y-1">
        {queue.map((message) => (
          <div
            key={message.id}
            class="flex items-start gap-2 px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
          >
            {/* Message preview */}
            <div class="flex-1 min-w-0">
              <p class="text-sm text-[var(--color-text-secondary)] truncate">
                {message.content.length > 100
                  ? `${message.content.slice(0, 100)}...`
                  : message.content}
              </p>
            </div>

            {/* Remove button */}
            <button
              type="button"
              onClick={() => dequeueMessage(message.id)}
              class="p-1 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors flex-shrink-0"
              title={t("actions.remove")}
              aria-label={t("actions.remove")}
            >
              <XIcon class="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
