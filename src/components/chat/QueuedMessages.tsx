/**
 * QueuedMessages
 *
 * Displays queued messages above the chat input with ability to edit or remove them.
 * Messages are auto-sent one at a time when the assistant stops streaming.
 */

import { useState, useRef } from "preact/hooks";
import { messageQueue, dequeueMessage, updateQueuedMessage } from "@/signals/chat";
import { t } from "@/lib/i18n";
import { compressImage } from "@/hooks/useAttachments";
import { isSupportedImage } from "@/types/attachments";
import { Modal } from "@/components/ui/Modal";
import { ModalFooter } from "@/components/ui/ModalFooter";
import { Button } from "@/components/ui/Button";
import {
  XIcon,
  EditIcon,
  ChevronDownIcon,
  ImageIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/ui/icons";
import type { Message, MessageImage } from "@/types/messages";

/** Character threshold for showing expand/collapse toggle */
const COLLAPSE_THRESHOLD = 100;

/** Max image dimension for display in modal */
const MAX_PREVIEW_SIZE = 120;

export function QueuedMessages() {
  const queue = messageQueue.value;
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editImages, setEditImages] = useState<MessageImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setEditImages(message.images ?? []);
  };

  /** Check if edit has changes from original */
  const hasEditChanges = () => {
    if (!editingMessage) return false;
    const originalContent = editingMessage.content;
    const originalImages = editingMessage.images ?? [];

    // Check content change
    if (editContent.trim() !== originalContent) return true;

    // Check images change (length or any URL difference)
    if (editImages.length !== originalImages.length) return true;
    for (let i = 0; i < editImages.length; i++) {
      if (editImages[i].url !== originalImages[i].url) return true;
    }

    return false;
  };

  const handleSaveEdit = () => {
    if (editingMessage && (editContent.trim() || editImages.length > 0) && hasEditChanges()) {
      updateQueuedMessage(
        editingMessage.id,
        editContent.trim(),
        editImages.length > 0 ? editImages : undefined,
      );
      setEditingMessage(null);
      setEditContent("");
      setEditImages([]);
    }
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setEditContent("");
    setEditImages([]);
  };

  const handleRemoveImage = (index: number) => {
    setEditImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newImages: MessageImage[] = [];

    for (const file of Array.from(files)) {
      if (!isSupportedImage(file.type)) continue;

      try {
        // Use same compression as main chat input for consistency
        const { content } = await compressImage(file);
        newImages.push({ url: content, alt: file.name });
      } catch {
        // Skip failed files
      }
    }

    if (newImages.length > 0) {
      setEditImages((prev) => [...prev, ...newImages]);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
            const hasImages = message.images && message.images.length > 0;

            return (
              <div
                key={message.id}
                class="px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
              >
                {/* Message content */}
                <div class="flex items-start gap-2">
                  <div class="flex-1 min-w-0">
                    <p
                      class={`text-sm text-[var(--color-text-secondary)] break-words ${
                        isLong && !isExpanded ? "line-clamp-1" : "whitespace-pre-wrap"
                      }`}
                    >
                      {message.content}
                    </p>
                    {/* Image indicator */}
                    {hasImages && (
                      <div class="mt-1 flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                        <ImageIcon class="w-3 h-3" />
                        <span>{t("chat.imageCount", { count: message.images!.length })}</span>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div class="flex items-center gap-1 flex-shrink-0">
                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={() => handleEdit(message)}
                      class="p-1 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                      title={t("common.edit")}
                      aria-label={t("common.edit")}
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
                      <TrashIcon class="w-4 h-4" />
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
          <ModalFooter
            onCancel={handleCancelEdit}
            onConfirm={handleSaveEdit}
            confirmLabel={t("actions.save")}
            confirmDisabled={(!editContent.trim() && editImages.length === 0) || !hasEditChanges()}
          />
        }
      >
        <div class="space-y-4">
          {/* Text content */}
          <textarea
            value={editContent}
            onInput={(e) => setEditContent((e.target as HTMLTextAreaElement).value)}
            class="w-full h-48 p-3 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm resize-none focus:outline-none focus:border-[var(--color-accent)]"
            placeholder={t("chat.placeholder")}
          />

          {/* Images section */}
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-[var(--color-text-secondary)]">
                {t("chat.images")}
              </span>
              <Button
                variant="ghost"
                size="sm"
                icon={<PlusIcon class="w-4 h-4" />}
                onClick={() => fileInputRef.current?.click()}
              >
                {t("chat.addImage")}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                class="hidden"
                onChange={(e) => handleAddImages((e.target as HTMLInputElement).files)}
              />
            </div>

            {/* Image previews */}
            {editImages.length > 0 ? (
              <div class="flex flex-wrap gap-2">
                {editImages.map((img, index) => (
                  <div key={index} class="relative group">
                    <img
                      src={img.url}
                      alt={img.alt || `Image ${index + 1}`}
                      class="rounded-lg object-cover border border-[var(--color-border)]"
                      style={{ width: MAX_PREVIEW_SIZE, height: MAX_PREVIEW_SIZE }}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      class="absolute -top-2 -right-2 p-1 rounded-full bg-[var(--color-error)] text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                      title={t("actions.remove")}
                      aria-label={t("actions.remove")}
                    >
                      <XIcon class="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p class="text-sm text-[var(--color-text-muted)]">{t("chat.noImages")}</p>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
