/**
 * ChatView
 *
 * Main chat interface view.
 */

import { useSignal } from "@preact/signals";
import { t } from "@/lib/i18n";
import { isConnected } from "@/lib/gateway";
import { sendMessage, abortChat } from "@/lib/chat";
import {
  messages,
  isLoadingHistory,
  historyError,
  isStreaming,
  streamingContent,
} from "@/signals/chat";
import { activeSessionKey } from "@/signals/sessions";

export function ChatView() {
  const chatInput = useSignal("");
  const sending = useSignal(false);

  const handleSend = async () => {
    if (!chatInput.value.trim() || !activeSessionKey.value) return;

    sending.value = true;
    const message = chatInput.value;
    chatInput.value = "";

    try {
      await sendMessage(activeSessionKey.value, message);
    } catch (err) {
      console.error("Send failed:", err);
    } finally {
      sending.value = false;
    }
  };

  const handleAbort = () => {
    if (activeSessionKey.value) {
      abortChat(activeSessionKey.value);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isConnected.value) {
    return (
      <div class="flex-1 flex items-center justify-center p-8">
        <div class="text-center">
          <div class="text-6xl mb-4">🏖️</div>
          <h2 class="text-xl font-semibold mb-2">{t("app.name")}</h2>
          <p class="text-[var(--color-text-muted)]">{t("chat.placeholderDisabled")}</p>
        </div>
      </div>
    );
  }

  return (
    <div class="flex-1 flex flex-col overflow-hidden">
      {/* Messages area */}
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingHistory.value && (
          <div class="text-center text-[var(--color-text-muted)] py-8">{t("status.loading")}</div>
        )}

        {historyError.value && (
          <div class="text-center text-[var(--color-error)] py-8">{historyError.value}</div>
        )}

        {!isLoadingHistory.value && messages.value.length === 0 && (
          <div class="flex-1 flex items-center justify-center py-16">
            <div class="text-center">
              <h3 class="text-lg font-medium mb-1">{t("chat.emptyState.title")}</h3>
              <p class="text-[var(--color-text-muted)]">{t("chat.emptyState.description")}</p>
            </div>
          </div>
        )}

        {messages.value.map((msg) => (
          <MessageBubble key={msg.id} messageRole={msg.role} content={msg.content} />
        ))}

        {/* Streaming indicator */}
        {isStreaming.value && (
          <MessageBubble messageRole="assistant" content={streamingContent.value} isStreaming />
        )}
      </div>

      {/* Input area */}
      <div class="border-t border-[var(--color-border)] p-4 bg-[var(--color-bg-surface)]">
        <div class="max-w-4xl mx-auto flex gap-3">
          <textarea
            value={chatInput.value}
            onInput={(e) => (chatInput.value = (e.target as HTMLTextAreaElement).value)}
            onKeyDown={handleKeyDown}
            placeholder={t("chat.placeholder")}
            rows={1}
            class="flex-1 px-4 py-3 text-sm rounded-lg
              bg-[var(--color-bg-primary)] border border-[var(--color-border)]
              resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]
              placeholder:text-[var(--color-text-muted)]"
          />
          <div class="flex flex-col gap-2">
            {isStreaming.value ? (
              <button
                type="button"
                onClick={handleAbort}
                class="px-4 py-3 text-sm font-medium rounded-lg
                  bg-[var(--color-error)] text-white hover:opacity-90 transition-opacity"
              >
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={sending.value || !chatInput.value.trim()}
                class="px-4 py-3 text-sm font-medium rounded-lg
                  bg-[var(--color-accent)] text-white
                  hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed
                  transition-opacity"
              >
                {t("actions.send")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

interface MessageBubbleProps {
  messageRole: "user" | "assistant" | "system";
  content: string;
  isStreaming?: boolean;
}

function MessageBubble({ messageRole, content, isStreaming = false }: MessageBubbleProps) {
  const isUser = messageRole === "user";
  const isSystem = messageRole === "system";

  return (
    <div
      class={`
        flex ${isUser ? "justify-end" : "justify-start"}
      `}
    >
      <div
        class={`
          max-w-[80%] px-4 py-3 rounded-2xl
          ${
            isUser
              ? "bg-[var(--color-accent)] text-white rounded-br-md"
              : isSystem
                ? "bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] text-sm italic"
                : "bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-bl-md"
          }
        `}
      >
        {content ||
          (isStreaming && (
            <span class="text-[var(--color-text-muted)] animate-pulse">{t("chat.thinking")}</span>
          ))}
      </div>
    </div>
  );
}
