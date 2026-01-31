/**
 * ChatInput
 *
 * Message input with auto-resize, keyboard shortcuts, and send button.
 */

import { useRef, useEffect, useCallback } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { t } from "@/lib/i18n";
import { IconButton, SendIcon, StopIcon } from "@/components/ui";

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
    [handleSend],
  );

  /**
   * Focus textarea on mount
   */
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const canSend = value.value.trim().length > 0 && !disabled && !isStreaming;

  return (
    <div class="px-3 pb-3 pt-2">
      <div class="max-w-5xl mx-auto">
        <div class="flex gap-2 items-end">
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
              class="w-full px-4 py-2.5 text-sm rounded-2xl resize-none
                bg-[var(--color-bg-surface)] border border-[var(--color-border)]
                shadow-soft-sm focus:shadow-soft
                focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent
                placeholder:text-[var(--color-text-muted)]
                disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
                transition-all duration-200 ease-out"
              style={{ minHeight: "42px", maxHeight: "200px" }}
            />
          </div>

          {/* Action buttons */}
          <div class="flex gap-2 flex-shrink-0">
            {isStreaming ? (
              <IconButton
                icon={<StopIcon />}
                label={t("actions.stop")}
                onClick={onAbort}
                variant="danger"
                size="md"
                class="rounded-xl shadow-soft-sm"
              />
            ) : (
              <IconButton
                icon={<SendIcon />}
                label={t("actions.send")}
                onClick={handleSend}
                disabled={!canSend}
                size="md"
                class="rounded-xl bg-[var(--color-accent)] text-white shadow-soft hover:shadow-soft-lg hover:opacity-95 disabled:opacity-50 disabled:shadow-none"
              />
            )}
          </div>
        </div>

        {/* Keyboard hint - only on hover/focus */}
        <div class="mt-1 text-[10px] text-[var(--color-text-muted)] text-center opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <span class="hidden sm:inline">
            <kbd class="px-1 py-0.5 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border)]">
              Enter
            </kbd>{" "}
            send ·{" "}
            <kbd class="px-1 py-0.5 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border)]">
              Shift+Enter
            </kbd>{" "}
            new line
          </span>
        </div>
      </div>
    </div>
  );
}
