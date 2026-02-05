/**
 * ChatInput
 *
 * Unified message input container with embedded action buttons.
 * Supports file attachments, image paste, and message queuing.
 */

import { useRef, useEffect, useCallback } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { Image } from "lucide-preact";
import { t } from "@/lib/i18n";
import { hasContent } from "@/lib/utils";
import { getDraft, setDraft, clearDraft } from "@/signals/chat";
import { SendIcon, StopIcon } from "@/components/ui/icons";
import { Tooltip } from "@/components/ui/Tooltip";
import { useAttachments } from "@/hooks/useAttachments";
import { ModelPicker } from "./ModelPicker";
import { QueuedMessages } from "./QueuedMessages";
import { AttachmentPreview } from "./AttachmentPreview";
import type { AttachmentPayload } from "@/types/attachments";

/** Max height for textarea before it becomes scrollable (accounts for bottom action bar) */
const TEXTAREA_MAX_HEIGHT = 160;

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
  // Initialize from draft if session key provided
  const value = useSignal(sessionKey ? getDraft(sessionKey) : "");
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
    const newHeight = Math.min(textarea.scrollHeight, TEXTAREA_MAX_HEIGHT);
    textarea.style.height = `${newHeight}px`;
  }, []);

  /**
   * Handle input changes
   */
  const handleInput = useCallback(
    (e: Event) => {
      const newValue = (e.target as HTMLTextAreaElement).value;
      value.value = newValue;
      // Persist draft for this session
      if (sessionKey) {
        setDraft(sessionKey, newValue);
      }
      autoResize();
    },
    [autoResize, sessionKey],
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
    // Clear the persisted draft
    if (sessionKey) {
      clearDraft(sessionKey);
    }
    clearAttachments();

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [onSend, disabled, getPayloads, clearAttachments, sessionKey]);

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
   * Focus textarea on mount and restore draft when session changes
   */
  useEffect(() => {
    textareaRef.current?.focus();
    // Restore draft for this session
    if (sessionKey) {
      const draft = getDraft(sessionKey);
      value.value = draft;
      // Resize textarea if there's existing content
      if (draft) {
        requestAnimationFrame(autoResize);
      }
    }
  }, [sessionKey, autoResize]);

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
          data-tour="chat-input"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          class={`
            relative flex flex-col bg-[var(--color-bg-surface)] border rounded-xl
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
            <div class="pt-3 px-4">
              <AttachmentPreview
                attachments={attachments}
                onRemove={removeAttachment}
                isProcessing={isProcessing}
              />
            </div>
          )}

          {/* Textarea - no bottom padding, action bar is separate */}
          <textarea
            ref={textareaRef}
            value={value.value}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={onPaste}
            disabled={disabled}
            placeholder={
              placeholder ||
              (window.innerWidth < 640 ? t("chat.placeholderMobile") : t("chat.placeholder"))
            }
            rows={1}
            class={`
              w-full px-4 pb-1 text-base sm:text-sm rounded-t-xl resize-none
              bg-transparent border-none
              placeholder:text-[var(--color-text-muted)]
              disabled:opacity-50 disabled:cursor-not-allowed
              ${hasAttachments ? "pt-2" : "pt-3"}
            `}
            style={{ minHeight: "44px", maxHeight: `${TEXTAREA_MAX_HEIGHT}px`, outline: "none" }}
          />

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileChange}
            class="hidden"
          />

          {/* Bottom bar with actions - not absolute, natural flow */}
          <div class="px-2 pb-2 pt-1 flex items-center justify-between">
            {/* Left side: Model picker + Attach button */}
            <div class="flex items-center gap-1">
              {sessionKey && (
                <div data-tour="model-picker">
                  <ModelPicker
                    sessionKey={sessionKey}
                    currentModel={currentModel}
                    onModelChange={onModelChange}
                  />
                </div>
              )}

              {/* Attach image button */}
              <Tooltip content={t("chat.attachImage")} placement="top">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled}
                  aria-label={t("chat.attachImage")}
                  class="
                    p-1.5 rounded-lg cursor-pointer
                    text-[var(--color-text-muted)]
                    hover:text-[var(--color-text-secondary)]
                    hover:bg-[var(--color-bg-hover)]
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-colors
                  "
                >
                  <Image class="w-4 h-4" aria-hidden="true" />
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
                  class="p-2 sm:px-3 sm:py-1.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer
                    bg-[var(--color-error)]/10 text-[var(--color-error)]
                    hover:bg-[var(--color-error)]/20
                    active:scale-95 transition-all duration-150"
                >
                  <StopIcon class="w-4 h-4" />
                  <span class="hidden sm:inline text-xs font-medium">{t("actions.stop")}</span>
                </button>
              )}

              {/* Send button */}
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                aria-label={isStreaming ? t("actions.queue") : t("actions.send")}
                class={`p-2 sm:px-3 sm:py-1.5 rounded-lg flex items-center justify-center gap-1.5
                  transition-all duration-150 active:scale-95
                  ${
                    canSend
                      ? "bg-[var(--color-accent)] text-white hover:opacity-90 cursor-pointer"
                      : "bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] cursor-not-allowed"
                  }`}
              >
                <SendIcon class="w-4 h-4" />
                <span class="hidden sm:inline text-xs font-medium">
                  {isStreaming ? t("actions.queue") : t("actions.send")}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
