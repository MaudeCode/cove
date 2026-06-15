/**
 * ChatView
 *
 * Main chat interface view.
 * Route: /chat/:sessionKey?
 */

import { useEffect, useRef } from "preact/hooks";
import { useComputed } from "@preact/signals";
import { route } from "preact-router";
import { isConnected, connectionState, mainSessionKey } from "@/lib/gateway";
import { useQueryParam, useInitFromParam, useSyncToParam } from "@/hooks/useQueryParam";
import {
  sendMessage,
  abortChat,
  processMessageQueue,
  steerQueuedMessage,
  retryMessage,
} from "@/lib/chat/send";
import { loadHistory } from "@/lib/chat/history";
import { clearExpandedToolCalls } from "@/components/chat/ToolCall";
import {
  filteredMessages,
  searchQuery,
  isSearchOpen,
  isLoadingHistory,
  historyError,
  clearMessages,
  clearActiveRuns,
  hasQueuedMessages,
  messageQueue,
  getCachedSessionKey,
  getStreamingStateForSession,
  getStreamingRun,
} from "@/signals/chat";
import {
  activeSessionKey,
  setActiveSession,
  effectiveSessionKey,
  activeSession,
  updateSession,
} from "@/signals/sessions";
import { assistantName, assistantAvatar, userName, userAvatar } from "@/signals/identity";
import { chatSteeringSettings, isSingleChatMode } from "@/signals/settings";
import { MessageList } from "@/components/chat/MessageList";
import { ChatInput } from "@/components/chat/ChatInput";
import { ConnectionBanner } from "@/components/chat/ConnectionBanner";
import type { Message } from "@/types/messages";

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

  // URL query params for search
  const [searchParam, setSearchParam] = useQueryParam("q");

  // Sync URL → search state on mount
  useInitFromParam(searchParam, searchQuery, (s) => s);

  // Auto-open search panel if URL has search param
  useEffect(() => {
    if (searchParam.value && !isSearchOpen.value) {
      isSearchOpen.value = true;
    }
  }, [searchParam.value]);

  // Sync search state → URL
  useSyncToParam(searchQuery, setSearchParam);

  // Sync session from URL to signal, and redirect /chat to actual main session URL
  useEffect(() => {
    // Decode URL-encoded session key (e.g., "agent%3Amain%3Amain" -> "agent:main:main")
    const decodedKey = sessionKey ? decodeURIComponent(sessionKey) : null;

    // In single-chat mode, always use main session
    if (isSingleChatMode.value && mainSessionKey.value) {
      if (activeSessionKey.value !== mainSessionKey.value) {
        setActiveSession(mainSessionKey.value);
      }
      // Redirect URL to main if it's pointing elsewhere
      if (decodedKey && decodedKey !== mainSessionKey.value) {
        route(`/chat/${encodeURIComponent(mainSessionKey.value)}`, true);
      }
      return;
    }

    // If on /chat without a session key and we know the main session, redirect
    if (!decodedKey && mainSessionKey.value) {
      route(`/chat/${encodeURIComponent(mainSessionKey.value)}`, true);
      return;
    }

    const targetSession = decodedKey || "main";

    if (targetSession !== activeSessionKey.value) {
      setActiveSession(targetSession);
    }
  }, [sessionKey, mainSessionKey.value, isSingleChatMode.value]);

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
      clearExpandedToolCalls();
      // Clear search when switching sessions
      searchQuery.value = "";
      isSearchOpen.value = false;
    }

    // Load fresh history (will update cache when done)
    loadHistory(currentSession)
      .then(() => {
        if (isConnected.value && hasQueuedMessages.value) {
          processMessageQueue();
        }
      })
      .catch(() => {
        // Error will be shown via historyError signal
      });
  }, [activeSessionKey.value]);

  // Handle connection established (initial or reconnect)
  useEffect(() => {
    const connected = isConnected.value;
    const wasConnected = wasConnectedRef.current;
    wasConnectedRef.current = connected;

    if (!connected || wasConnected) return;

    // Clear stale runs - harmless on initial connect, necessary on reconnect
    clearActiveRuns();

    const currentSession = effectiveSessionKey.value;
    if (!currentSession) return;

    // Reconcile startup active-run state before replaying queued sends.
    loadHistory(currentSession)
      .then(() => {
        if (hasQueuedMessages.value) {
          processMessageQueue();
        }
      })
      .catch(() => {
        // Error will be shown via historyError signal
      });
  }, [connectionState.value]);

  const handleSend = async (
    message: string,
    attachments?: import("@/types/attachments").AttachmentPayload[],
  ) => {
    const sessionKey = effectiveSessionKey.value;
    if (!sessionKey) return;

    try {
      await sendMessage(sessionKey, message, { attachments });
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

  const handleSteerQueued = (messageId: string) => {
    steerQueuedMessage(messageId).catch(() => {
      // Error is handled by steerQueuedMessage (marks message as failed)
    });
  };

  const handleRetryQueued = (messageId: string) => {
    retryMessage(messageId).catch(() => {
      // Error is handled by retryMessage (marks message as failed)
    });
  };

  const canSteerQueued = (message: Message) => {
    if (!message.sessionKey || !isConnected.value) return false;
    return getStreamingRun(message.sessionKey) !== null;
  };

  // Get streaming state for current session only (useComputed ensures reactivity)
  const sessionStreamingState = useComputed(() =>
    getStreamingStateForSession(effectiveSessionKey.value),
  );

  return (
    <div class="flex-1 flex flex-col overflow-hidden relative" data-tour="chat-view">
      {/* Connection status banner */}
      <ConnectionBanner />

      <MessageList
        messages={filteredMessages.value}
        isLoading={isLoadingHistory.value}
        error={historyError.value}
        streamingContent={sessionStreamingState.value.content}
        streamingToolCalls={sessionStreamingState.value.toolCalls}
        isStreaming={sessionStreamingState.value.isStreaming}
        assistantName={assistantName.value}
        assistantAvatar={assistantAvatar.value ?? undefined}
        userName={userName.value}
        userAvatar={userAvatar.value ?? undefined}
        queuedCount={messageQueue.value.length}
      />

      <ChatInput
        onSend={handleSend}
        onSteerQueued={handleSteerQueued}
        onRetryQueued={handleRetryQueued}
        canSteerQueued={canSteerQueued}
        onAbort={handleAbort}
        disabled={false} // Allow typing even when disconnected (will queue)
        isStreaming={sessionStreamingState.value.isStreaming}
        steerByDefault={chatSteeringSettings.value.steerByDefault}
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
