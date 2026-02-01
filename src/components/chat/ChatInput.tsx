/**
 * ChatInput
 *
 * Unified message input container with embedded action buttons.
 * Supports file attachments, image paste, and message queuing.
 */

import { useRef, useEffect, useCallback } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { Paperclip } from "lucide-preact";
import { t } from "@/lib/i18n";
import { hasContent } from "@/lib/utils";
import { SendIcon, StopIcon, Tooltip } from "@/components/ui";
import { useAttachments } from "@/hooks";
import { ModelPicker } from "./ModelPicker";
import { QueuedMessages } from "./QueuedMessages";
import { AttachmentPreview } from "./AttachmentPreview";
import type { AttachmentPayload } from "@/types/attachments";

interface ChatInputProps {
  onSend: (message: string, attachments?: AttachmentPayload[]) => void;
  onAbort?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  placeholder?: string;
  sessionKey?: string;
  currentModel?: string;
  onModelChange?: (modelId: string) => void;
}

export function ChatInput({
  onSend,
  onAbort,
  disabled = false,
  isStreaming = false,
  placeholder,
  sessionKey,
  currentModel,
  onModelChange,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const value = useSignal("");
  const isDragging = useSignal(false);

  const {
    attachments,
    addFiles,
    removeAttachment,
    clearAttachments,
    getPayloads,
    handlePaste,
    isProcessing,
    error: attachmentError,
    clearError,
  } = useAttachments();

  /**
   * Auto-resize textarea based on content
   */
  const autoResize = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const newHeight = Math.min(textarea.scrollHeight, 200);
    textarea.style.height = `${newHeight}px`;
  }, []);

  /**
   * Handle input changes
   */
  const handleInput = useCallback(
    (e: Event) => {
      value.value = (e.target as HTMLTextAreaElement).value;
      autoResize();
    },
    [autoResize],
  );

  /**
   * Send message with attachments
   */
  const handleSend = useCallback(() => {
    const message = value.value.trim();
    const payloads = getPayloads();

    // Need either message or attachments
    if ((!message && payloads.length === 0) || disabled) return;

    onSend(message, payloads.length > 0 ? payloads : undefined);
    value.value = "";
    clearAttachments();

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [onSend, disabled, getPayloads, clearAttachments]);

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSend();
        return;
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  /**
   * Handle paste (for images)
   */
  const onPaste = useCallback(
    async (e: ClipboardEvent) => {
      await handlePaste(e);
    },
    [handlePaste],
  );

  /**
   * Handle file input change
   */
  const handleFileChange = useCallback(
    (e: Event) => {
      const input = e.target as HTMLInputElement;
      if (input.files && input.files.length > 0) {
        addFiles(input.files);
        input.value = ""; // Reset so same file can be selected again
      }
    },
    [addFiles],
  );

  /**
   * Handle drag events
   */
  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDragging.value = true;
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if leaving the container (not entering a child)
    if (e.relatedTarget && containerRef.current?.contains(e.relatedTarget as Node)) {
      return;
    }
    isDragging.value = false;
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isDragging.value = false;

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        await addFiles(files);
      }
    },
    [addFiles],
  );

  /**
   * Focus textarea on mount
   */
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  /**
   * Clear error after a delay
   */
  useEffect(() => {
    if (attachmentError) {
      const timer = setTimeout(clearError, 5000);
      return () => clearTimeout(timer);
    }
  }, [attachmentError, clearError]);

  const hasText = hasContent(value.value);
  const hasAttachments = attachments.length > 0;
  const canSend = (hasText || hasAttachments) && !disabled;

  return (
    <div class="pb-3 pt-2">
      <div class="max-w-5xl mx-auto px-6">
        {/* Queued messages display */}
        <QueuedMessages />

        {/* Error message */}
        {attachmentError && (
          <div class="mb-2 px-3 py-2 text-sm text-[var(--color-error)] bg-[var(--color-error)]/10 rounded-lg">
            {attachmentError}
          </div>
        )}

        {/* Unified input container */}
        <div
          ref={containerRef}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          class={`
            relative bg-[var(--color-bg-surface)] border rounded-xl
            transition-all duration-200
            ${isDragging.value ? "border-[var(--color-accent)] bg-[var(--color-accent)]/5" : "border-[var(--color-border)] focus-within:border-[var(--color-accent)]"}
          `}
        >
          {/* Drag overlay */}
          {isDragging.value && (
            <div class="absolute inset-0 flex items-center justify-center bg-[var(--color-accent)]/10 rounded-xl z-10 pointer-events-none">
              <span class="text-sm font-medium text-[var(--color-accent)]">
                {t("chat.dropFiles")}
              </span>
            </div>
          )}

          {/* Attachment previews + processing indicator */}
          {(hasAttachments || isProcessing) && (
            <div class="pt-3">
              <AttachmentPreview
                attachments={attachments}
                onRemove={removeAttachment}
                isProcessing={isProcessing}
              />
            </div>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value.value}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={onPaste}
            disabled={disabled}
            placeholder={placeholder || t("chat.placeholder")}
            rows={1}
            class={`
              w-full px-4 pb-12 text-sm rounded-xl resize-none
              bg-transparent border-none outline-none
              placeholder:text-[var(--color-text-muted)]
              disabled:opacity-50 disabled:cursor-not-allowed
              ${hasAttachments ? "pt-2" : "pt-3"}
            `}
            style={{ minHeight: "60px", maxHeight: "200px" }}
          />

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.txt,.md,.json,.csv"
            onChange={handleFileChange}
            class="hidden"
          />

          {/* Bottom bar with actions */}
          <div class="absolute bottom-2 left-2 right-2 flex items-center justify-between">
            {/* Left side: Model picker + Attach button */}
            <div class="flex items-center gap-1">
              {sessionKey && (
                <ModelPicker
                  sessionKey={sessionKey}
                  currentModel={currentModel}
                  onModelChange={onModelChange}
                />
              )}

              {/* Attach button */}
              <Tooltip content={t("chat.attachFile")} placement="top">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled}
                  aria-label={t("chat.attachFile")}
                  class="
                    p-1.5 rounded-lg cursor-pointer
                    text-[var(--color-text-muted)]
                    hover:text-[var(--color-text-secondary)]
                    hover:bg-[var(--color-bg-hover)]
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-colors
                  "
                >
                  <Paperclip class="w-4 h-4" />
                </button>
              </Tooltip>
            </div>

            {/* Right side: Stop + Send buttons */}
            <div class="flex items-center gap-1.5">
              {/* Stop button - only during streaming */}
              {isStreaming && (
                <button
                  type="button"
                  onClick={onAbort}
                  aria-label={t("actions.stop")}
                  class="px-3 py-1.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer
                    bg-[var(--color-error)]/10 text-[var(--color-error)]
                    hover:bg-[var(--color-error)]/20
                    active:scale-95 transition-all duration-150"
                >
                  <StopIcon class="w-4 h-4" />
                  <span class="text-xs font-medium">{t("actions.stop")}</span>
                </button>
              )}

              {/* Send button */}
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                aria-label={isStreaming ? t("actions.queue") : t("actions.send")}
                class={`px-3 py-1.5 rounded-lg flex items-center justify-center gap-1.5
                  transition-all duration-150 active:scale-95
                  ${
                    canSend
                      ? "bg-[var(--color-accent)] text-white hover:opacity-90 cursor-pointer"
                      : "bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] cursor-not-allowed"
                  }`}
              >
                <SendIcon class="w-4 h-4" />
                {(hasText || hasAttachments || isStreaming) && (
                  <span class="text-xs font-medium">
                    {isStreaming ? t("actions.queue") : t("actions.send")}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
