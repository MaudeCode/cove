/**
 * Chat Send
 *
 * Sending messages, retrying, and queue processing.
 */

import { send, isConnected } from "@/lib/gateway";
import { log } from "@/lib/logger";
import {
  messages,
  addMessage,
  startRun,
  errorRun,
  queueMessage,
  dequeueMessage,
  messageQueue,
  markMessageFailed,
  markMessageSending,
  markMessageSent,
  isStreaming,
} from "@/signals/chat";
import type { Message } from "@/types/messages";
import type { ChatSendResult } from "@/types/chat";

let idempotencyCounter = 0;

function generateIdempotencyKey(): string {
  return `cove_${Date.now()}_${++idempotencyCounter}`;
}

/**
 * Send a chat message.
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
  const isRetry = options?.messageId != null;

  const userMessage: Message = {
    id: messageId,
    role: "user",
    content: message,
    timestamp: Date.now(),
    isStreaming: false,
    status: "sending",
    sessionKey,
  };

  // Queue if disconnected - don't add to chat yet
  if (!isConnected.value) {
    log.chat.info("Not connected, queuing message");
    userMessage.status = "queued";
    queueMessage(userMessage);
    return idempotencyKey;
  }

  // Queue if currently streaming - don't add to chat yet
  if (isStreaming.value && !isRetry) {
    log.chat.info("Currently streaming, queuing message");
    userMessage.status = "queued";
    queueMessage(userMessage);
    return idempotencyKey;
  }

  // Not queued - add to chat and send immediately
  if (!isRetry) {
    addMessage(userMessage);
  } else {
    markMessageSending(messageId);
  }

  startRun(idempotencyKey, sessionKey);

  try {
    log.chat.debug("Sending message to session:", sessionKey);

    const result = await send<ChatSendResult>("chat.send", {
      sessionKey,
      message,
      thinking: options?.thinking,
      timeoutMs: options?.timeoutMs,
      idempotencyKey,
    });

    if (result.status === "error") {
      const errorMsg = result.summary ?? "Unknown error";
      errorRun(idempotencyKey, errorMsg);
      markMessageFailed(messageId, errorMsg);
      throw new Error(errorMsg);
    }

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
 * Resend a message (shared logic for retry and queue processing).
 * Adds message to chat if not already there, then sends.
 */
export async function resendMessage(message: Message): Promise<void> {
  if (!message.sessionKey) {
    log.chat.warn("Cannot resend message - missing sessionKey:", message.id);
    return;
  }

  // Remove from queue
  dequeueMessage(message.id);

  // Add to chat if not already there (for queued messages that weren't in chat)
  const existingInChat = messages.value.find((m) => m.id === message.id);
  if (!existingInChat) {
    addMessage({ ...message, status: "sending" });
  } else {
    markMessageSending(message.id);
  }

  const idempotencyKey = message.id.replace(/^user_/, "");
  await sendMessage(message.sessionKey, message.content, { messageId: idempotencyKey });
}

/**
 * Process the next queued message for a session (called after streaming completes).
 */
export async function processNextQueuedMessage(sessionKey: string): Promise<void> {
  // Check if still streaming (another run might have started)
  if (isStreaming.value) {
    log.chat.debug("Still streaming, not processing queue");
    return;
  }

  // Find first queued message for this session
  const nextMessage = messageQueue.value.find((m) => m.sessionKey === sessionKey);
  if (!nextMessage) {
    log.chat.debug("No queued messages for session");
    return;
  }

  log.chat.info("Processing next queued message:", nextMessage.id);

  try {
    await resendMessage(nextMessage);
  } catch (err) {
    log.chat.error("Failed to send queued message:", err);
  }
}

/**
 * Retry sending a failed message.
 * Looks in both the message queue (for queued messages) and messages list (for failed sends).
 */
export async function retryMessage(messageId: string): Promise<void> {
  // First check the queue (for messages queued while disconnected)
  let message = messageQueue.value.find((m) => m.id === messageId);

  // If not in queue, check the messages list (for failed sends)
  if (!message) {
    message = messages.value.find((m) => m.id === messageId && m.status === "failed");
  }

  if (!message) {
    log.chat.warn("Cannot retry message - not found:", messageId);
    return;
  }

  await resendMessage(message);
}

/**
 * Process the message queue (call after reconnecting).
 */
export async function processMessageQueue(): Promise<void> {
  const queue = [...messageQueue.value];
  if (queue.length === 0) return;

  log.chat.info(`Processing ${queue.length} queued messages`);

  for (const message of queue) {
    try {
      await resendMessage(message);
    } catch (err) {
      log.chat.error("Failed to send queued message:", err);
    }
  }
}

/**
 * Abort the current chat run.
 */
export async function abortChat(sessionKey: string): Promise<void> {
  await send("chat.abort", { sessionKey });
}

/**
 * Abort a specific run.
 */
export async function abortRun(sessionKey: string, runId: string): Promise<void> {
  await send("chat.abort", { sessionKey, runId });
}
