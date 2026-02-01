/**
 * QueuedMessages
 *
 * Displays queued messages above the chat input with ability to edit or remove them.
 * Messages are auto-sent one at a time when the assistant stops streaming.
 */

import { useState } from "preact/hooks";
import { messageQueue, dequeueMessage, updateQueuedMessage } from "@/signals/chat";
import { t } from "@/lib/i18n";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { XIcon, EditIcon, ChevronDownIcon } from "@/components/ui/icons";
import type { Message } from "@/types/messages";

/** Character threshold for collapsing long messages */
const COLLAPSE_THRESHOLD = 150;

export function QueuedMessages() {
  const queue = messageQueue.value;
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editContent, setEditContent] = useState("");

  if (queue.length === 0) return null;

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleEdit = (message: Message) => {
    setEditingMessage(message);
    setEditContent(message.content);
  };

  const handleSaveEdit = () => {
    if (editingMessage && editContent.trim()) {
      updateQueuedMessage(editingMessage.id, editContent.trim());
      setEditingMessage(null);
      setEditContent("");
    }
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setEditContent("");
  };

  return (
    <>
      <div class="mb-2 space-y-2">
        <div class="text-xs text-[var(--color-text-muted)] font-medium">
          {t("chat.queuedMessages", { count: queue.length })}
        </div>
        <div class="space-y-1">
          {queue.map((message) => {
            const isLong = message.content.length > COLLAPSE_THRESHOLD;
            const isExpanded = expandedIds.has(message.id);
            const displayContent =
              isLong && !isExpanded
                ? `${message.content.slice(0, COLLAPSE_THRESHOLD)}…`
                : message.content;

            return (
              <div
                key={message.id}
                class="px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
              >
                {/* Message content */}
                <div class="flex items-start gap-2">
                  <div class="flex-1 min-w-0">
                    <p class="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap break-words">
                      {displayContent}
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div class="flex items-center gap-1 flex-shrink-0">
                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={() => handleEdit(message)}
                      class="p-1 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                      title={t("actions.edit")}
                      aria-label={t("actions.edit")}
                    >
                      <EditIcon class="w-4 h-4" />
                    </button>

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => dequeueMessage(message.id)}
                      class="p-1 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors"
                      title={t("actions.remove")}
                      aria-label={t("actions.remove")}
                    >
                      <XIcon class="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expand/collapse toggle for long messages */}
                {isLong && (
                  <button
                    type="button"
                    onClick={() => toggleExpand(message.id)}
                    class="mt-1 flex items-center gap-1 text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
                  >
                    <ChevronDownIcon class="w-3 h-3" open={isExpanded} />
                    {isExpanded ? t("actions.showLess") : t("actions.showMore")}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        open={!!editingMessage}
        onClose={handleCancelEdit}
        title={t("chat.editQueuedMessage")}
        size="lg"
        footer={
          <div class="flex justify-end gap-2">
            <Button variant="ghost" onClick={handleCancelEdit}>
              {t("actions.cancel")}
            </Button>
            <Button variant="primary" onClick={handleSaveEdit} disabled={!editContent.trim()}>
              {t("actions.save")}
            </Button>
          </div>
        }
      >
        <textarea
          value={editContent}
          onInput={(e) => setEditContent((e.target as HTMLTextAreaElement).value)}
          class="w-full h-48 p-3 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm resize-none focus:outline-none focus:border-[var(--color-accent)]"
          placeholder={t("chat.placeholder")}
        />
      </Modal>
    </>
  );
}
