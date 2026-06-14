/**
 * Chat Send
 *
 * Sending messages, retrying, and queue processing.
 */

import { effect } from "@preact/signals";
import { send, isConnected, isUnknownGatewayMethodError } from "@/lib/gateway";
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
  markMessageSteered,
  markMessageSending,
  markMessageSent,
  updateQueuedMessageState,
  isStreaming,
  clearMessages,
  adoptRunId,
  getStreamingRun,
} from "@/signals/chat";
import { sessions } from "@/signals/sessions";
import { chatSteeringSettings } from "@/signals/settings";
import { autoRenameSession } from "./auto-rename";
import { getAgentId, isUserCreatedChat } from "@/lib/session-utils";
import { t } from "@/lib/i18n";
import { loadHistory } from "./history";
import {
  markResetHistoryFailed,
  markResetHistorySucceeded,
  registerResetRun,
} from "./reset-reconciliation";
import { attachmentsToImages, getResendAttachments } from "./attachments";
import { registerChatCleanup } from "./cleanup";
import type { AttachmentPayload } from "@/types/attachments";
import type { Message } from "@/types/messages";

/**
 * Session reset commands that clear the current session.
 * These match OpenClaw's DEFAULT_RESET_TRIGGERS.
 */
const RESET_COMMANDS = ["/new", "/reset"];
const SOFT_STEER_COMMANDS = ["/steer", "/tell"];
const REDIRECT_COMMANDS = ["/redirect"];

/**
 * Check if a message is a session reset command.
 */
function isResetCommand(message: string): boolean {
  const trimmed = message.trim().toLowerCase();
  // Exact match or command with arguments (e.g., "/new some context")
  return RESET_COMMANDS.some((cmd) => trimmed === cmd || trimmed.startsWith(`${cmd} `));
}

function parseCommandPayload(message: string, commands: string[]): string | null {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();
  for (const command of commands) {
    if (lower === command) return "";
    if (lower.startsWith(`${command} `)) {
      return trimmed.slice(command.length).trim();
    }
  }
  return null;
}

let idempotencyCounter = 0;

type AbortParams = {
  key: string;
  runId?: string;
  agentId?: string;
};

const pendingAbortParams = new Map<string, AbortParams>();
let pendingAbortReplayPromise: Promise<boolean> | null = null;

effect(() => {
  if (!isConnected.value) return;
  if (pendingAbortParams.size === 0) return;
  void replayPendingAborts();
});

registerChatCleanup(clearPendingAborts);

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
    steer?: boolean;
    redirect?: boolean;
  },
): Promise<string> {
  const idempotencyKey = options?.messageId ?? generateIdempotencyKey();
  const messageId = `user_${idempotencyKey}`;
  const isRetry = options?.messageId != null;
  const softSteerCommand = parseCommandPayload(message, SOFT_STEER_COMMANDS);
  const redirectCommand = parseCommandPayload(message, REDIRECT_COMMANDS);
  const isExplicitSoftSteer = softSteerCommand !== null;
  const isExplicitRedirect = redirectCommand !== null;
  const activeSessionRun = getStreamingRun(sessionKey);
  const canSteerActiveRun = activeSessionRun !== null;
  const wantsActiveRunSteer =
    (isExplicitSoftSteer && canSteerActiveRun) ||
    (options?.steer === true && canSteerActiveRun) ||
    (!isRetry && chatSteeringSettings.value.steerByDefault && activeSessionRun !== null);
  const shouldHardSteer =
    isExplicitRedirect ||
    (wantsActiveRunSteer && chatSteeringSettings.value.steeringMode === "hard");
  const shouldSoftSteer = wantsActiveRunSteer && !shouldHardSteer;
  const shouldRedirect = isExplicitRedirect || options?.redirect === true;
  const shouldSteer = wantsActiveRunSteer || shouldRedirect;
  const shouldUseSessionsSteer = shouldRedirect || shouldHardSteer;
  const sendContent = isExplicitSoftSteer
    ? (softSteerCommand ?? "")
    : isExplicitRedirect
      ? (redirectCommand ?? "")
      : message;

  const userMessage: Message = {
    id: messageId,
    role: "user",
    content: sendContent,
    images: attachmentsToImages(options?.attachments),
    pendingAttachments: options?.attachments,
    timestamp: Date.now(),
    isStreaming: false,
    status: "sending",
    sessionKey,
    steered: shouldSteer,
  };

  if ((isExplicitSoftSteer || isExplicitRedirect) && !sendContent) {
    userMessage.status = "failed";
    userMessage.error = t("chat.steerEmptyError");
    addMessage(userMessage);
    throw new Error(t("chat.steerEmptyError"));
  }

  // Queue if disconnected - don't add to chat yet
  if (!isConnected.value) {
    if (shouldSteer) {
      userMessage.status = "failed";
      userMessage.error = t("chat.steerUnavailableDisconnected");
      addMessage(userMessage);
      throw new Error(t("chat.steerUnavailableDisconnected"));
    }
    log.chat.info("Not connected, queuing message");
    userMessage.status = "queued";
    queueMessage(userMessage);
    return idempotencyKey;
  }

  // Queue if currently streaming - don't add to chat yet
  if (isStreaming.value && !isRetry && !shouldSteer) {
    log.chat.info("Currently streaming, queuing message");
    userMessage.status = "queued";
    queueMessage(userMessage);
    return idempotencyKey;
  }

  if (shouldSoftSteer) {
    if (!activeSessionRun) {
      userMessage.status = "failed";
      userMessage.error = t("chat.steerUnavailable");
      if (!isRetry) {
        addMessage(userMessage);
      } else {
        markMessageFailed(messageId, t("chat.steerUnavailable"));
      }
      throw new Error(t("chat.steerUnavailable"));
    }

    await sendSoftSteerInput(sessionKey, userMessage, idempotencyKey, activeSessionRun.runId, {
      attachments: options?.attachments,
      idempotencyKey,
      thinking: options?.thinking,
      timeoutMs: options?.timeoutMs,
    });

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
    const result = shouldUseSessionsSteer
      ? await sendRedirect(sessionKey, sendContent, {
          attachments: options?.attachments,
          idempotencyKey,
          thinking: options?.thinking,
          timeoutMs: options?.timeoutMs,
        })
      : await sendChat(sessionKey, sendContent, {
          attachments: options?.attachments,
          idempotencyKey,
          thinking: options?.thinking,
          timeoutMs: options?.timeoutMs,
        });

    if (result.status === "error") {
      const errorMsg = result.summary ?? "Unknown error";
      errorRun(idempotencyKey, errorMsg);
      markMessageFailed(messageId, errorMsg);
      throw new Error(errorMsg);
    }

    adoptRunId(idempotencyKey, result.runId);

    const isReset = isResetCommand(message);
    const resetRunId = isReset ? result.runId : undefined;
    if (isReset) {
      registerResetRun(resetRunId);
    }

    if (shouldSteer) {
      markMessageSteered(messageId);
    } else {
      markMessageSent(messageId);
    }
    if (shouldUseSessionsSteer) {
      clearOrdinaryQueuedMessagesForSession(sessionKey);
    }

    // Handle session reset commands (/new, /reset)
    // Clear local messages and reload history (which will be empty for the new session)
    if (isReset) {
      log.chat.info("Reset command detected, clearing messages for session:", sessionKey);
      // Small delay to let the gateway finish creating the new session
      setTimeout(() => {
        clearMessages();
        // Reload history to get any welcome message or confirm empty state
        loadHistory(sessionKey)
          .then(() => {
            markResetHistorySucceeded(resetRunId);
          })
          .catch((err) => {
            const fallbackMessage = markResetHistoryFailed(resetRunId);
            if (fallbackMessage) {
              addMessage(fallbackMessage);
            }
            log.chat.warn("Failed to reload history after reset:", err);
          });
      }, 100);
    }

    // Auto-rename on first message in user-created chats
    // Only rename if session label is still "New Chat" (not already renamed)
    if (!isRetry && !shouldSteer && isUserCreatedChat(sessionKey)) {
      const session = sessions.value.find((s) => s.key === sessionKey);
      const newChatLabel = t("common.newChat");
      if (session?.label === newChatLabel) {
        // Fire and forget - don't block on rename, but log failures
        autoRenameSession(sessionKey, sendContent).catch((err) => {
          log.chat.warn("Auto-rename failed:", err instanceof Error ? err.message : String(err));
        });
      }
    }

    return idempotencyKey;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const methodName = shouldUseSessionsSteer ? "sessions.steer" : "chat.send";
    log.chat.error(`${methodName} failed:`, err);
    errorRun(idempotencyKey, errorMsg);
    markMessageFailed(messageId, errorMsg);
    throw err;
  }
}

type MessageSendOptions = {
  thinking?: string;
  timeoutMs?: number;
  idempotencyKey: string;
  attachments?: AttachmentPayload[];
};

async function sendSoftSteerInput(
  sessionKey: string,
  message: Message,
  idempotencyKey: string,
  activeRunId: string,
  options: MessageSendOptions,
): Promise<void> {
  const pendingMessage: Message = {
    ...message,
    status: "sending",
    steered: true,
    queueKind: "steered",
    pendingRunId: activeRunId,
  };
  queueMessage(pendingMessage);

  try {
    const result = await sendSoftSteer(sessionKey, message.content, options);
    if (result.status === "error") {
      const errorMsg = result.summary ?? "Unknown error";
      updateQueuedMessageState(message.id, { status: "failed", error: errorMsg });
      throw new Error(errorMsg);
    }

    updateQueuedMessageState(message.id, {
      status: "sent",
      error: undefined,
      pendingRunId: activeRunId,
      queueKind: "steered",
      steered: true,
    });
    markMessageSteered(message.id);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.chat.error("chat.send steer failed:", err);
    updateQueuedMessageState(message.id, { status: "failed", error: errorMsg });
    markMessageFailed(message.id, errorMsg);
    throw err;
  }
}

function clearOrdinaryQueuedMessagesForSession(sessionKey: string): void {
  messageQueue.value = messageQueue.value.filter(
    (message) =>
      message.sessionKey !== sessionKey || message.pendingRunId || message.queueKind === "steered",
  );
}

async function sendChat(sessionKey: string, message: string, options: MessageSendOptions) {
  log.chat.debug("Sending message to session:", sessionKey);

  return send("chat.send", {
    sessionKey,
    message,
    thinking: options.thinking,
    timeoutMs: options.timeoutMs,
    idempotencyKey: options.idempotencyKey,
    attachments: options.attachments,
  });
}

async function sendSoftSteer(sessionKey: string, message: string, options: MessageSendOptions) {
  log.chat.debug("Sending steering input to active session:", sessionKey);

  return send("chat.send", {
    sessionKey,
    message,
    deliver: false,
    thinking: options.thinking,
    timeoutMs: options.timeoutMs,
    idempotencyKey: options.idempotencyKey,
    attachments: options.attachments,
  });
}

async function sendRedirect(sessionKey: string, message: string, options: MessageSendOptions) {
  log.chat.debug("Redirecting active session:", sessionKey);

  try {
    return await send("sessions.steer", {
      key: sessionKey,
      message,
      thinking: options.thinking,
      timeoutMs: options.timeoutMs,
      idempotencyKey: options.idempotencyKey,
      attachments: options.attachments,
    });
  } catch (err) {
    if (isUnknownGatewayMethodError(err, "sessions.steer")) {
      throw new Error(t("chat.steerUnavailable"));
    }
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
  await sendMessage(message.sessionKey, message.content, {
    attachments: getResendAttachments(message),
    messageId: idempotencyKey,
    steer: message.steered === true,
  });
}

export async function steerQueuedMessage(messageId: string): Promise<void> {
  const message = messageQueue.value.find((m) => m.id === messageId);
  if (!message) {
    log.chat.warn("Cannot steer queued message - not found:", messageId);
    return;
  }

  if (!message.sessionKey) {
    log.chat.warn("Cannot steer queued message - missing sessionKey:", message.id);
    return;
  }

  const activeRun = getStreamingRun(message.sessionKey);
  if (!activeRun) {
    log.chat.warn("Cannot steer queued message - no active run:", message.id);
    return;
  }

  const originalMessage = message;
  const idempotencyKey = message.id.replace(/^user_/, "");
  if (chatSteeringSettings.value.steeringMode === "hard") {
    await resendMessage({ ...message, steered: true });
    return;
  }

  updateQueuedMessageState(message.id, {
    status: "sending",
    error: undefined,
    steered: true,
    queueKind: "steered",
    pendingRunId: activeRun.runId,
  });

  try {
    const result = await sendSoftSteer(message.sessionKey, message.content, {
      attachments: getResendAttachments(message),
      idempotencyKey,
    });

    if (result.status === "error") {
      const errorMsg = result.summary ?? "Unknown error";
      throw new Error(errorMsg);
    }

    updateQueuedMessageState(message.id, {
      status: "sent",
      error: undefined,
      steered: true,
      queueKind: "steered",
      pendingRunId: activeRun.runId,
    });
  } catch (err) {
    log.chat.error("chat.send steer failed:", err);
    updateQueuedMessageState(message.id, {
      ...originalMessage,
      queueKind: undefined,
      pendingRunId: undefined,
      steered: false,
    });
    throw err;
  }
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
  const nextMessage = messageQueue.value.find(
    (m) => m.sessionKey === sessionKey && !m.pendingRunId && m.queueKind !== "steered",
  );
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
  const abortsReplayed = await replayPendingAborts();
  if (!abortsReplayed) return;

  const queue = messageQueue.value.filter(
    (message) => !message.pendingRunId && message.queueKind !== "steered",
  );
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
  const params = buildAbortParams(sessionKey);

  if (!isConnected.value) {
    pendingAbortParams.set(sessionKey, params);
    return;
  }

  try {
    await send("sessions.abort", params);
  } catch (err) {
    pendingAbortParams.set(sessionKey, params);
    throw err;
  }
}

export function clearPendingAborts(): void {
  pendingAbortParams.clear();
}

async function replayPendingAborts(): Promise<boolean> {
  if (!isConnected.value || pendingAbortParams.size === 0) return true;
  if (pendingAbortReplayPromise) return pendingAbortReplayPromise;

  pendingAbortReplayPromise = (async () => {
    for (const [sessionKey, params] of pendingAbortParams) {
      try {
        await send("sessions.abort", params);
        pendingAbortParams.delete(sessionKey);
      } catch (err) {
        log.chat.warn("Failed to replay pending abort:", err);
        return false;
      }
    }

    return true;
  })();

  try {
    return await pendingAbortReplayPromise;
  } finally {
    pendingAbortReplayPromise = null;
  }
}

function buildAbortParams(sessionKey: string): AbortParams {
  const run = getStreamingRun(sessionKey);
  const agentId = getAgentId(sessionKey) ?? undefined;

  return {
    key: sessionKey,
    ...(run?.runId ? { runId: run.runId } : {}),
    ...(agentId ? { agentId } : {}),
  };
}
