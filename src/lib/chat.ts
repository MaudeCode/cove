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

import { send, on, isConnected } from "@/lib/gateway";
import { log } from "@/lib/logger";
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
  queueMessage,
  dequeueMessage,
  messageQueue,
  markMessageFailed,
  markMessageSending,
  markMessageSent,
  activeRuns,
} from "@/signals/chat";
import type { Message } from "@/types/messages";
import type { ChatHistoryResult, ChatSendResult, ChatEvent } from "@/types/chat";
import { parseMessageContent, mergeToolCalls, normalizeMessage } from "@/types/chat";

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

    // Convert raw messages to our Message type with tool calls
    const normalized: Message[] = result.messages.map((raw, index) =>
      normalizeMessage(raw, `hist_${index}_${Date.now()}`),
    );

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
    messageId?: string; // For retry
  },
): Promise<string> {
  const idempotencyKey = options?.messageId ?? generateIdempotencyKey();
  const messageId = `user_${idempotencyKey}`;

  // Check if this is a retry (message already exists)
  const isRetry = options?.messageId != null;

  if (!isRetry) {
    // Add user message to the list immediately with "sending" status
    const userMessage: Message = {
      id: messageId,
      role: "user",
      content: message,
      timestamp: Date.now(),
      isStreaming: false,
      status: "sending",
      sessionKey,
    };
    addMessage(userMessage);
  } else {
    // Update existing message to "sending"
    markMessageSending(messageId);
  }

  // If not connected, queue the message
  if (!isConnected.value) {
    log.chat.info("Not connected, queuing message");
    const queuedMessage: Message = {
      id: messageId,
      role: "user",
      content: message,
      timestamp: Date.now(),
      status: "sending",
      sessionKey,
    };
    queueMessage(queuedMessage);
    return idempotencyKey;
  }

  // Start tracking the run
  startRun(idempotencyKey, sessionKey);

  try {
    log.chat.debug("Sending message to session:", sessionKey, "message:", message.slice(0, 50));

    const result = await send<ChatSendResult>("chat.send", {
      sessionKey,
      message,
      thinking: options?.thinking,
      timeoutMs: options?.timeoutMs,
      idempotencyKey,
    });

    log.chat.debug("chat.send result:", result);

    if (result.status === "error") {
      const errorMsg = result.summary ?? "Unknown error";
      errorRun(idempotencyKey, errorMsg);
      markMessageFailed(messageId, errorMsg);
      throw new Error(errorMsg);
    }

    // Mark message as sent
    markMessageSent(messageId);
    return idempotencyKey;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.chat.error("chat.send failed:", err);
    errorRun(idempotencyKey, errorMsg);
    markMessageFailed(messageId, errorMsg);
    throw err;
  }
}

/**
 * Retry sending a failed message
 */
export async function retryMessage(messageId: string): Promise<void> {
  // Find the message in the queue
  const message = messageQueue.value.find((m) => m.id === messageId);

  // If not in queue, can't retry
  if (!message) {
    log.chat.warn("Cannot retry message not in queue:", messageId);
    return;
  }

  if (!message.sessionKey) {
    log.chat.error("Cannot retry message without sessionKey");
    return;
  }

  // Remove from queue
  dequeueMessage(messageId);

  // Extract the original idempotency key from message ID
  const idempotencyKey = messageId.replace(/^user_/, "");

  // Resend with the same ID
  await sendMessage(message.sessionKey, message.content, {
    messageId: idempotencyKey,
  });
}

/**
 * Process the message queue (call after reconnecting)
 */
export async function processMessageQueue(): Promise<void> {
  const queue = [...messageQueue.value];
  if (queue.length === 0) return;

  log.chat.info(`Processing ${queue.length} queued messages`);

  for (const message of queue) {
    if (!message.sessionKey) continue;

    try {
      dequeueMessage(message.id);
      const idempotencyKey = message.id.replace(/^user_/, "");
      await sendMessage(message.sessionKey, message.content, {
        messageId: idempotencyKey,
      });
    } catch (err) {
      log.chat.error("Failed to send queued message:", err);
      // Message will be marked as failed, user can retry manually
    }
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

  console.log("[CHAT] Subscribing to chat events");
  chatEventUnsubscribe = on("chat", (payload) => {
    console.log("[CHAT] Received chat event payload:", payload);
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

  // Debug: log full event to console
  console.log("[CHAT EVENT]", JSON.stringify(event, null, 2));
  log.chat.debug("Chat event:", state, runId, message ? "has message" : "no message");

  switch (state) {
    case "delta": {
      // Streaming content update - parse both text and tool calls
      if (message) {
        const parsed = parseMessageContent(message.content);
        const existingRun = activeRuns.value.get(runId);

        // Merge tool calls with existing ones (to track status changes)
        const mergedToolCalls = existingRun
          ? mergeToolCalls(existingRun.toolCalls, parsed.toolCalls)
          : parsed.toolCalls;

        updateRunContent(runId, parsed.text, mergedToolCalls);
      }
      break;
    }

    case "final": {
      // Message complete - create final message with tool calls
      if (message) {
        const finalMessage = normalizeMessage(message, `assistant_${runId}`);
        completeRun(runId, finalMessage);
      } else {
        completeRun(runId);
      }
      break;
    }

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
