/**
 * ChatView
 *
 * Main chat interface view.
 */

import { useEffect, useRef } from "preact/hooks";
import { t } from "@/lib/i18n";
import { isConnected } from "@/lib/gateway";
import { sendMessage, abortChat, loadHistory } from "@/lib/chat";
import {
  messages,
  isLoadingHistory,
  historyError,
  isStreaming,
  streamingContent,
  clearMessages,
} from "@/signals/chat";
import { activeSessionKey } from "@/signals/sessions";
import { MessageList, ChatInput } from "@/components/chat";

export function ChatView() {
  const prevSessionRef = useRef<string | null>(null);

  // Load history when session changes
  useEffect(() => {
    const currentSession = activeSessionKey.value;

    // Skip if no session or same session
    if (!currentSession || currentSession === prevSessionRef.current) {
      return;
    }

    prevSessionRef.current = currentSession;

    // Clear existing messages and load new history
    clearMessages();
    loadHistory(currentSession).catch(() => {
      // Error will be shown via historyError signal
    });
  }, [activeSessionKey.value]);
  const handleSend = async (message: string) => {
    if (!activeSessionKey.value) return;

    try {
      await sendMessage(activeSessionKey.value, message);
    } catch {
      // Error is displayed via historyError signal
    }
  };

  const handleAbort = () => {
    if (activeSessionKey.value) {
      abortChat(activeSessionKey.value);
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
      <MessageList
        messages={messages.value}
        isLoading={isLoadingHistory.value}
        error={historyError.value}
        streamingContent={streamingContent.value}
        isStreaming={isStreaming.value}
      />

      <ChatInput
        onSend={handleSend}
        onAbort={handleAbort}
        disabled={!isConnected.value}
        isStreaming={isStreaming.value}
      />
    </div>
  );
}
