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
  clearMessages,
} from "@/signals/chat";
import { sessions } from "@/signals/sessions";
import { autoRenameSession } from "./auto-rename";
import { isUserCreatedChat } from "@/lib/session-utils";
import { t } from "@/lib/i18n";
import { loadHistory } from "./history";
import type { Message, MessageImage } from "@/types/messages";
import type { ChatSendResult } from "@/types/chat";
import type { AttachmentPayload } from "@/types/attachments";

/**
 * Session reset commands that clear the current session.
 * These match OpenClaw's DEFAULT_RESET_TRIGGERS.
 */
const RESET_COMMANDS = ["/new", "/reset"];

/**
 * Check if a message is a session reset command.
 */
function isResetCommand(message: string): boolean {
  const trimmed = message.trim().toLowerCase();
  // Exact match or command with arguments (e.g., "/new some context")
  return RESET_COMMANDS.some((cmd) => trimmed === cmd || trimmed.startsWith(`${cmd} `));
}

let idempotencyCounter = 0;

/**
 * Convert attachment payloads to message images for local display.
 * Note: Only images are stored — OpenClaw drops non-image attachments.
 */
function attachmentsToImages(attachments?: AttachmentPayload[]): MessageImage[] | undefined {
  if (!attachments || attachments.length === 0) return undefined;

  const images: MessageImage[] = [];
  for (const att of attachments) {
    if (att.type === "image") {
      images.push({
        url: att.content, // content is already a data URL
        alt: att.fileName,
      });
    }
  }

  return images.length > 0 ? images : undefined;
}

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
    attachments?: AttachmentPayload[];
  },
): Promise<string> {
  const idempotencyKey = options?.messageId ?? generateIdempotencyKey();
  const messageId = `user_${idempotencyKey}`;
  const isRetry = options?.messageId != null;

  const userMessage: Message = {
    id: messageId,
    role: "user",
    content: message,
    images: attachmentsToImages(options?.attachments),
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
      attachments: options?.attachments,
    });

    if (result.status === "error") {
      const errorMsg = result.summary ?? "Unknown error";
      errorRun(idempotencyKey, errorMsg);
      markMessageFailed(messageId, errorMsg);
      throw new Error(errorMsg);
    }

    markMessageSent(messageId);

    // Handle session reset commands (/new, /reset)
    // Clear local messages and reload history (which will be empty for the new session)
    if (isResetCommand(message)) {
      log.chat.info("Reset command detected, clearing messages for session:", sessionKey);
      // Small delay to let the gateway finish creating the new session
      setTimeout(() => {
        clearMessages();
        // Reload history to get any welcome message or confirm empty state
        loadHistory(sessionKey).catch((err) => {
          log.chat.warn("Failed to reload history after reset:", err);
        });
      }, 100);
    }

    // Auto-rename on first message in user-created chats
    // Only rename if session label is still "New Chat" (not already renamed)
    if (!isRetry && isUserCreatedChat(sessionKey)) {
      const session = sessions.value.find((s) => s.key === sessionKey);
      const newChatLabel = t("common.newChat");
      if (session?.label === newChatLabel) {
        // Fire and forget - don't block on rename, but log failures
        autoRenameSession(sessionKey, message).catch((err) => {
          log.chat.warn("Auto-rename failed:", err instanceof Error ? err.message : String(err));
        });
      }
    }

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
async function resendMessage(message: Message): Promise<void> {
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
