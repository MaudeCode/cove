/**
 * ChatView
 *
 * Main chat interface view.
 * Route: /chat/:sessionKey?
 */

import { useEffect, useRef } from "preact/hooks";
import { isConnected, connectionState } from "@/lib/gateway";
import { sendMessage, abortChat, loadHistory, processMessageQueue } from "@/lib/chat";
import {
  messages,
  isLoadingHistory,
  historyError,
  isStreaming,
  streamingContent,
  streamingToolCalls,
  clearMessages,
  hasQueuedMessages,
} from "@/signals/chat";
import { activeSessionKey, setActiveSession, effectiveSessionKey } from "@/signals/sessions";
import { assistantName, assistantAvatar, userName, userAvatar } from "@/signals/identity";
import { MessageList, ChatInput, ConnectionBanner } from "@/components/chat";

interface ChatViewProps {
  /** Route path (from preact-router) */
  path?: string;
  /** Session key from URL (from preact-router) */
  sessionKey?: string;
}

export function ChatView({ sessionKey }: ChatViewProps) {
  const prevSessionRef = useRef<string | null>(null);
  const wasConnectedRef = useRef<boolean>(false);

  // Sync session from URL to signal
  useEffect(() => {
    // Decode URL-encoded session key (e.g., "agent%3Amain%3Amain" -> "agent:main:main")
    const decodedKey = sessionKey ? decodeURIComponent(sessionKey) : null;
    const targetSession = decodedKey || "main";

    if (targetSession !== activeSessionKey.value) {
      setActiveSession(targetSession);
    }
  }, [sessionKey]);

  // Load history when effective session changes
  useEffect(() => {
    const currentSession = effectiveSessionKey.value;

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
  }, [effectiveSessionKey.value]);

  // Process queued messages on reconnect
  useEffect(() => {
    const connected = isConnected.value;

    // Detect reconnection (was disconnected, now connected)
    if (connected && !wasConnectedRef.current && hasQueuedMessages.value) {
      processMessageQueue();
    }

    wasConnectedRef.current = connected;
  }, [connectionState.value]);

  const handleSend = async (message: string) => {
    const sessionKey = effectiveSessionKey.value;
    if (!sessionKey) return;

    try {
      await sendMessage(sessionKey, message);
    } catch {
      // Error is handled by sendMessage (marks message as failed)
    }
  };

  const handleAbort = () => {
    const sessionKey = effectiveSessionKey.value;
    if (sessionKey) {
      abortChat(sessionKey);
    }
  };

  return (
    <div class="flex-1 flex flex-col overflow-hidden">
      {/* Connection status banner */}
      <ConnectionBanner />

      <MessageList
        messages={messages.value}
        isLoading={isLoadingHistory.value}
        error={historyError.value}
        streamingContent={streamingContent.value}
        streamingToolCalls={streamingToolCalls.value}
        isStreaming={isStreaming.value}
        assistantName={assistantName.value}
        assistantAvatar={assistantAvatar.value ?? undefined}
        userName={userName.value}
        userAvatar={userAvatar.value ?? undefined}
      />

      <ChatInput
        onSend={handleSend}
        onAbort={handleAbort}
        disabled={false} // Allow typing even when disconnected (will queue)
        isStreaming={isStreaming.value}
      />
    </div>
  );
}
