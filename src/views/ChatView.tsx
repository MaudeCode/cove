/**
 * ChatView
 *
 * Main chat interface view.
 * Route: /chat/:sessionKey?
 */

import { useEffect, useRef } from "preact/hooks";
import { route } from "preact-router";
import { isConnected, connectionState, mainSessionKey } from "@/lib/gateway";
import { sendMessage, abortChat, loadHistory, processMessageQueue } from "@/lib/chat";
import {
  filteredMessages,
  searchQuery,
  isSearchOpen,
  isLoadingHistory,
  historyError,
  activeRuns,
  clearMessages,
  hasQueuedMessages,
  messageQueue,
  getCachedSessionKey,
  getStreamingStateForSession,
} from "@/signals/chat";
import {
  activeSessionKey,
  setActiveSession,
  effectiveSessionKey,
  activeSession,
  updateSession,
} from "@/signals/sessions";
import { assistantName, assistantAvatar, userName, userAvatar } from "@/signals/identity";
import {
  MessageList,
  ChatInput,
  ConnectionBanner,
  CompactionBanner,
  SearchBar,
} from "@/components/chat";

interface ChatViewProps {
  /** Route path (from preact-router) */
  path?: string;
  /** Session key from URL (from preact-router) */
  sessionKey?: string;
  /** Default route (from preact-router) */
  default?: boolean;
}

export function ChatView({ sessionKey }: ChatViewProps) {
  const prevSessionRef = useRef<string | null>(null);
  const wasConnectedRef = useRef<boolean>(false);

  // Sync session from URL to signal, and redirect /chat to actual main session URL
  useEffect(() => {
    // Decode URL-encoded session key (e.g., "agent%3Amain%3Amain" -> "agent:main:main")
    const decodedKey = sessionKey ? decodeURIComponent(sessionKey) : null;

    // If on /chat without a session key and we know the main session, redirect
    if (!decodedKey && mainSessionKey.value) {
      route(`/chat/${encodeURIComponent(mainSessionKey.value)}`, true);
      return;
    }

    const targetSession = decodedKey || "main";

    if (targetSession !== activeSessionKey.value) {
      setActiveSession(targetSession);
    }
  }, [sessionKey, mainSessionKey.value]);

  // Load history when session changes
  // Note: We track activeSessionKey.value directly because Preact signals
  // don't re-trigger useEffect when a computed signal changes
  useEffect(() => {
    const currentSession = effectiveSessionKey.value;

    // Skip if no session or same session
    if (!currentSession || currentSession === prevSessionRef.current) {
      return;
    }

    prevSessionRef.current = currentSession;

    // Only clear messages if switching to a different session than cached
    // (keeps cached messages visible for the same session until fresh ones load)
    const cachedSession = getCachedSessionKey();
    if (cachedSession !== currentSession) {
      clearMessages();
      // Clear search when switching sessions
      searchQuery.value = "";
      isSearchOpen.value = false;
    }

    // Load fresh history (will update cache when done)
    loadHistory(currentSession).catch(() => {
      // Error will be shown via historyError signal
    });
  }, [activeSessionKey.value]);

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

  // Get streaming state for current session only (accessing activeRuns.value for reactivity)
  const _runs = activeRuns.value; // Access for reactivity
  const sessionStreamingState = getStreamingStateForSession(effectiveSessionKey.value);

  return (
    <div class="flex-1 flex flex-col overflow-hidden">
      {/* Connection status banner */}
      <ConnectionBanner />

      {/* Compaction status banner */}
      <CompactionBanner />

      {/* Search bar */}
      <SearchBar />

      <MessageList
        messages={filteredMessages.value}
        isLoading={isLoadingHistory.value}
        error={historyError.value}
        streamingContent={sessionStreamingState.content}
        streamingToolCalls={sessionStreamingState.toolCalls}
        isStreaming={sessionStreamingState.isStreaming}
        assistantName={assistantName.value}
        assistantAvatar={assistantAvatar.value ?? undefined}
        userName={userName.value}
        userAvatar={userAvatar.value ?? undefined}
        queuedCount={messageQueue.value.length}
      />

      <ChatInput
        onSend={handleSend}
        onAbort={handleAbort}
        disabled={false} // Allow typing even when disconnected (will queue)
        isStreaming={sessionStreamingState.isStreaming}
        sessionKey={effectiveSessionKey.value}
        currentModel={activeSession.value?.model}
        onModelChange={(modelId) => {
          if (effectiveSessionKey.value) {
            updateSession(effectiveSessionKey.value, { model: modelId });
          }
        }}
      />
    </div>
  );
}
