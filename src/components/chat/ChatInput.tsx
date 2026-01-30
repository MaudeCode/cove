/**
 * ChatInput
 *
 * Message input with auto-resize, keyboard shortcuts, and send button.
 */

import { useRef, useEffect, useCallback } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { t } from "@/lib/i18n";

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

    // Reset height to calculate new height
    textarea.style.height = "auto";

    // Set new height (max 200px)
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
   * Handle keyboard shortcuts
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Cmd/Ctrl+Enter always sends
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSend();
        return;
      }

      // Enter sends (Shift+Enter for newline)
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [value.value],
  );

  /**
   * Send message
   */
  const handleSend = useCallback(() => {
    const message = value.value.trim();
    if (!message || disabled || isStreaming) return;

    onSend(message);
    value.value = "";

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [onSend, disabled, isStreaming]);

  /**
   * Focus textarea on mount
   */
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const canSend = value.value.trim().length > 0 && !disabled && !isStreaming;

  return (
    <div class="border-t border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4">
      <div class="max-w-4xl mx-auto">
        <div class="flex gap-3 items-end">
          {/* Textarea */}
          <div class="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={value.value}
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              placeholder={placeholder || t("chat.placeholder")}
              rows={1}
              class="w-full px-4 py-3 text-sm rounded-xl resize-none
                bg-[var(--color-bg-primary)] border border-[var(--color-border)]
                focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent
                placeholder:text-[var(--color-text-muted)]
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-shadow"
              style={{ minHeight: "44px", maxHeight: "200px" }}
            />
          </div>

          {/* Action buttons */}
          <div class="flex gap-2 flex-shrink-0">
            {isStreaming ? (
              <button
                type="button"
                onClick={onAbort}
                class="px-4 py-3 text-sm font-medium rounded-xl
                  bg-[var(--color-error)] text-white
                  hover:opacity-90 transition-opacity"
                aria-label="Stop generating"
              >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                class="px-4 py-3 text-sm font-medium rounded-xl
                  bg-[var(--color-accent)] text-white
                  hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed
                  transition-opacity"
                aria-label={t("actions.send")}
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Keyboard hint */}
        <div class="mt-2 text-xs text-[var(--color-text-muted)] text-center">
          <span class="hidden sm:inline">
            <kbd class="px-1.5 py-0.5 rounded bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
              Enter
            </kbd>{" "}
            to send,{" "}
            <kbd class="px-1.5 py-0.5 rounded bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
              Shift+Enter
            </kbd>{" "}
            for new line
          </span>
        </div>
      </div>
    </div>
  );
}
