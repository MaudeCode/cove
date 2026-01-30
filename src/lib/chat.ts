/**
 * Chat Methods
 *
 * High-level chat operations that combine gateway calls with state updates.
 *
 * Usage:
 *   import { loadHistory, sendMessage, abortChat } from '@/lib/chat'
 *
 *   await loadHistory('main')
 *   await sendMessage('main', 'Hello!')
 *   abortChat('main')
 */

import { send, on } from "@/lib/gateway";
import {
  isLoadingHistory,
  historyError,
  thinkingLevel,
  setMessages,
  addMessage,
  startRun,
  updateRunContent,
  completeRun,
  errorRun,
  abortRun as abortRunSignal,
  clearMessages,
} from "@/signals/chat";
import type { Message } from "@/types/messages";
import type { ChatHistoryResult, ChatSendResult, ChatEvent } from "@/types/chat";
import { normalizeMessageContent } from "@/types/chat";

// ============================================
// History
// ============================================

/**
 * Load chat history for a session
 */
export async function loadHistory(sessionKey: string, limit = 200): Promise<void> {
  isLoadingHistory.value = true;
  historyError.value = null;

  try {
    const result = await send<ChatHistoryResult>("chat.history", {
      sessionKey,
      limit,
    });

    // Convert raw messages to our Message type
    const normalized: Message[] = result.messages.map((raw, index) => ({
      id: `hist_${index}_${Date.now()}`,
      role: raw.role,
      content: normalizeMessageContent(raw.content),
      timestamp: raw.timestamp ?? Date.now(),
      isStreaming: false,
    }));

    setMessages(normalized);

    if (result.thinkingLevel) {
      thinkingLevel.value = result.thinkingLevel;
    }
  } catch (err) {
    historyError.value = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    isLoadingHistory.value = false;
  }
}

/**
 * Reload history for current session
 */
export async function reloadHistory(sessionKey: string): Promise<void> {
  clearMessages();
  await loadHistory(sessionKey);
}

// ============================================
// Sending Messages
// ============================================

let idempotencyCounter = 0;

/**
 * Generate a unique idempotency key
 */
function generateIdempotencyKey(): string {
  return `cove_${Date.now()}_${++idempotencyCounter}`;
}

/**
 * Send a chat message
 */
export async function sendMessage(
  sessionKey: string,
  message: string,
  options?: {
    thinking?: string;
    timeoutMs?: number;
  },
): Promise<string> {
  const idempotencyKey = generateIdempotencyKey();

  // Add user message to the list immediately
  const userMessage: Message = {
    id: `user_${idempotencyKey}`,
    role: "user",
    content: message,
    timestamp: Date.now(),
    isStreaming: false,
  };
  addMessage(userMessage);

  // Start tracking the run
  startRun(idempotencyKey, sessionKey);

  try {
    const result = await send<ChatSendResult>("chat.send", {
      sessionKey,
      message,
      thinking: options?.thinking,
      timeoutMs: options?.timeoutMs,
      idempotencyKey,
    });

    if (result.status === "error") {
      errorRun(idempotencyKey, result.summary ?? "Unknown error");
      throw new Error(result.summary ?? "Failed to send message");
    }

    return idempotencyKey;
  } catch (err) {
    errorRun(idempotencyKey, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

// ============================================
// Abort
// ============================================

/**
 * Abort all chat runs for a session
 */
export async function abortChat(sessionKey: string): Promise<void> {
  await send("chat.abort", { sessionKey });
}

/**
 * Abort a specific chat run
 */
export async function abortRun(sessionKey: string, runId: string): Promise<void> {
  await send("chat.abort", { sessionKey, runId });
}

// ============================================
// Event Handling
// ============================================

let chatEventUnsubscribe: (() => void) | null = null;

/**
 * Subscribe to chat events from the gateway
 */
export function subscribeToChatEvents(): () => void {
  if (chatEventUnsubscribe) {
    return chatEventUnsubscribe;
  }

  chatEventUnsubscribe = on("chat", (payload) => {
    const event = payload as ChatEvent;
    handleChatEvent(event);
  });

  return chatEventUnsubscribe;
}

/**
 * Unsubscribe from chat events
 */
export function unsubscribeFromChatEvents(): void {
  if (chatEventUnsubscribe) {
    chatEventUnsubscribe();
    chatEventUnsubscribe = null;
  }
}

/**
 * Handle a chat event from the gateway
 */
function handleChatEvent(event: ChatEvent): void {
  const { runId, state, message, errorMessage } = event;

  switch (state) {
    case "delta":
      // Streaming content update
      if (message) {
        const content = normalizeMessageContent(message.content);
        updateRunContent(runId, content);
      }
      break;

    case "final":
      // Message complete
      if (message) {
        const finalMessage: Message = {
          id: `assistant_${runId}`,
          role: message.role,
          content: normalizeMessageContent(message.content),
          timestamp: message.timestamp ?? Date.now(),
          isStreaming: false,
        };
        completeRun(runId, finalMessage);
      } else {
        completeRun(runId);
      }
      break;

    case "aborted":
      abortRunSignal(runId);
      break;

    case "error":
      errorRun(runId, errorMessage ?? "Unknown error");
      break;
  }
}

// ============================================
// Initialization
// ============================================

/**
 * Initialize chat system for a session
 */
export async function initChat(sessionKey: string): Promise<void> {
  // Subscribe to events
  subscribeToChatEvents();

  // Load history
  await loadHistory(sessionKey);
}

/**
 * Cleanup chat system
 */
export function cleanupChat(): void {
  unsubscribeFromChatEvents();
  clearMessages();
}
