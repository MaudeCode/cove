/**
 * ChatInput
 *
 * Unified message input container with embedded action buttons.
 * Supports queuing messages while streaming.
 */

import { useRef, useEffect, useCallback } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { t } from "@/lib/i18n";
import { SendIcon, StopIcon } from "@/components/ui";

interface ChatInputProps {
  onSend: (message: string) => void;
  onAbort?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  onAbort,
  disabled = false,
  isStreaming = false,
  placeholder,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const value = useSignal("");

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
   * Send message (queues if streaming)
   */
  const handleSend = useCallback(() => {
    const message = value.value.trim();
    if (!message || disabled) return;

    onSend(message);
    value.value = "";

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [onSend, disabled]);

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
   * Focus textarea on mount
   */
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const canSend = value.value.trim().length > 0 && !disabled;
  const hasText = value.value.trim().length > 0;

  return (
    <div class="px-3 pb-3 pt-2">
      <div class="max-w-5xl mx-auto">
        {/* Unified container */}
        <div
          class="relative bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl
            shadow-soft-sm focus-within:shadow-soft focus-within:border-[var(--color-accent)]/50
            transition-all duration-200"
        >
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value.value}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder || t("chat.placeholder")}
            rows={1}
            class="w-full px-4 pt-3 pb-12 text-sm rounded-xl resize-none
              bg-transparent border-none
              focus:outline-none
              placeholder:text-[var(--color-text-muted)]
              disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: "60px", maxHeight: "200px" }}
          />

          {/* Action buttons - bottom right, inside container */}
          <div class="absolute bottom-2 right-2 flex items-center gap-1.5">
            {/* Stop button - only during streaming */}
            {isStreaming && (
              <button
                type="button"
                onClick={onAbort}
                aria-label={t("actions.stop")}
                title={t("actions.stop")}
                class="px-3 py-1.5 rounded-lg flex items-center justify-center gap-1.5
                  bg-[var(--color-error)]/10 text-[var(--color-error)]
                  hover:bg-[var(--color-error)]/20
                  active:scale-95 transition-all duration-150"
              >
                <StopIcon class="w-4 h-4" />
                <span class="text-xs font-medium">Stop</span>
              </button>
            )}

            {/* Send button */}
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              aria-label={isStreaming ? t("actions.queue") : t("actions.send")}
              title={isStreaming ? "Queue message" : t("actions.send")}
              class={`px-3 py-1.5 rounded-lg flex items-center justify-center gap-1.5
                transition-all duration-150 active:scale-95
                ${
                  canSend
                    ? "bg-[var(--color-accent)] text-white hover:opacity-90"
                    : "bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] cursor-not-allowed"
                }`}
            >
              <SendIcon class="w-4 h-4" />
              {(hasText || isStreaming) && (
                <span class="text-xs font-medium">{isStreaming ? "Queue" : "Send"}</span>
              )}
            </button>
          </div>
        </div>

        {/* Keyboard hint */}
        <div class="mt-1.5 text-[10px] text-[var(--color-text-muted)] text-center">
          <kbd class="px-1 py-0.5 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border)]">
            Enter
          </kbd>{" "}
          {isStreaming ? "queue" : "send"} ·{" "}
          <kbd class="px-1 py-0.5 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border)]">
            Shift+Enter
          </kbd>{" "}
          new line
        </div>
      </div>
    </div>
  );
}
