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
import { DEFAULT_HISTORY_LIMIT, SAME_TURN_THRESHOLD_MS } from "@/lib/constants";
import { mergeDeltaText } from "@/lib/streaming";
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
import type { Message, ToolCall } from "@/types/messages";
import type { ChatHistoryResult, ChatSendResult, ChatEvent, AgentEvent } from "@/types/chat";
import { parseMessageContent, mergeToolCalls, normalizeMessage } from "@/types/chat";

// ============================================
// History
// ============================================

/**
 * Collect tool results from raw messages into a lookup map.
 */
function collectToolResults(
  rawMessages: ChatHistoryResult["messages"],
): Map<string, { content: unknown; isError: boolean }> {
  const results = new Map<string, { content: unknown; isError: boolean }>();

  for (const raw of rawMessages) {
    if (raw.role === "toolResult" && raw.toolCallId) {
      const resultContent =
        Array.isArray(raw.content) && raw.content[0]?.type === "text"
          ? raw.content[0].text
          : raw.content;
      results.set(raw.toolCallId, {
        content: resultContent,
        isError: raw.isError ?? false,
      });
    }
  }

  return results;
}

/**
 * Attach tool results to tool calls in a message.
 */
function attachToolResults(
  msg: Message,
  toolResults: Map<string, { content: unknown; isError: boolean }>,
): void {
  if (!msg.toolCalls) return;

  for (const tc of msg.toolCalls) {
    const result = toolResults.get(tc.id);
    if (result) {
      tc.result = result.content;
      tc.status = result.isError ? "error" : "complete";
      tc.completedAt = Date.now();
    }
  }
}

/**
 * Check if two messages should be merged (same turn).
 */
function shouldMergeMessages(prev: Message, curr: Message): boolean {
  return (
    prev.role === "assistant" &&
    curr.role === "assistant" &&
    Math.abs(curr.timestamp - prev.timestamp) < SAME_TURN_THRESHOLD_MS
  );
}

/**
 * Merge a message into the previous message (same turn consolidation).
 */
function mergeIntoMessage(prev: Message, curr: Message): void {
  const prevContentLen = prev.content.length;
  const separator = prev.content && curr.content ? "\n\n" : "";

  // Merge tool calls - adjust insertion positions for merged content
  if (curr.toolCalls && curr.toolCalls.length > 0) {
    const adjustedToolCalls = curr.toolCalls.map((tc) => ({
      ...tc,
      insertedAtContentLength:
        tc.insertedAtContentLength !== undefined
          ? prevContentLen + separator.length + tc.insertedAtContentLength
          : undefined,
    }));
    prev.toolCalls = [...(prev.toolCalls ?? []), ...adjustedToolCalls];
  }

  // Merge content
  if (curr.content) {
    prev.content = prev.content ? `${prev.content}${separator}${curr.content}` : curr.content;
  }

  // Update timestamp to latest
  prev.timestamp = Math.max(prev.timestamp, curr.timestamp);
}

/**
 * Load chat history for a session.
 */
export async function loadHistory(
  sessionKey: string,
  limit = DEFAULT_HISTORY_LIMIT,
): Promise<void> {
  isLoadingHistory.value = true;
  historyError.value = null;

  try {
    const result = await send<ChatHistoryResult>("chat.history", { sessionKey, limit });

    // First pass: collect tool results
    const toolResults = collectToolResults(result.messages);

    // Second pass: normalize and merge messages
    const normalized: Message[] = [];

    for (let index = 0; index < result.messages.length; index++) {
      const raw = result.messages[index];

      // Skip toolResult messages - they're merged into assistant messages
      if (raw.role === "toolResult") continue;

      const msg = normalizeMessage(raw, `hist_${index}_${Date.now()}`);
      attachToolResults(msg, toolResults);

      // Merge consecutive assistant messages from same turn
      const prev = normalized[normalized.length - 1];
      if (prev && shouldMergeMessages(prev, msg)) {
        mergeIntoMessage(prev, msg);
        continue;
      }

      normalized.push(msg);
    }

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
 * Reload history for current session.
 */
export async function reloadHistory(sessionKey: string): Promise<void> {
  clearMessages();
  await loadHistory(sessionKey);
}

// ============================================
// Sending Messages
// ============================================

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

  if (!isRetry) {
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
    markMessageSending(messageId);
  }

  // Queue if disconnected
  if (!isConnected.value) {
    log.chat.info("Not connected, queuing message");
    queueMessage({
      id: messageId,
      role: "user",
      content: message,
      timestamp: Date.now(),
      status: "sending",
      sessionKey,
    });
    return idempotencyKey;
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
 * Retry sending a failed message.
 */
export async function retryMessage(messageId: string): Promise<void> {
  const message = messageQueue.value.find((m) => m.id === messageId);
  if (!message?.sessionKey) {
    log.chat.warn("Cannot retry message:", messageId);
    return;
  }

  dequeueMessage(messageId);
  const idempotencyKey = messageId.replace(/^user_/, "");
  await sendMessage(message.sessionKey, message.content, { messageId: idempotencyKey });
}

/**
 * Process the message queue (call after reconnecting).
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
      await sendMessage(message.sessionKey, message.content, { messageId: idempotencyKey });
    } catch (err) {
      log.chat.error("Failed to send queued message:", err);
    }
  }
}

// ============================================
// Abort
// ============================================

export async function abortChat(sessionKey: string): Promise<void> {
  await send("chat.abort", { sessionKey });
}

export async function abortRun(sessionKey: string, runId: string): Promise<void> {
  await send("chat.abort", { sessionKey, runId });
}

// ============================================
// Event Handling
// ============================================

let chatEventUnsubscribe: (() => void) | null = null;

export function subscribeToChatEvents(): () => void {
  if (chatEventUnsubscribe) {
    return chatEventUnsubscribe;
  }

  log.chat.info("Subscribing to chat events");

  chatEventUnsubscribe = on("chat", (payload) => {
    handleChatEvent(payload as ChatEvent);
  });

  on("agent", (payload) => {
    const evt = payload as AgentEvent;
    if (evt.stream === "tool") {
      handleToolEvent(evt);
    }
  });

  return chatEventUnsubscribe;
}

export function unsubscribeFromChatEvents(): void {
  if (chatEventUnsubscribe) {
    chatEventUnsubscribe();
    chatEventUnsubscribe = null;
  }
}

/**
 * Handle a tool event from the agent stream.
 */
function handleToolEvent(evt: AgentEvent): void {
  const { runId, data } = evt;
  if (!data) return;

  let run = activeRuns.value.get(runId);

  // If no run exists (e.g., page refreshed mid-stream), create one on-the-fly
  if (!run) {
    log.chat.debug("Creating run on-the-fly for tool event:", runId);
    startRun(runId, "unknown");
    run = activeRuns.value.get(runId);
    if (!run) return;
  }

  const toolCallId = data.toolCallId ?? `tool_${Date.now()}`;
  const toolName = data.name ?? "unknown";
  const existingToolCalls = [...run.toolCalls];

  switch (data.phase) {
    case "start": {
      // Avoid duplicates
      if (existingToolCalls.some((tc) => tc.id === toolCallId)) return;

      const newToolCall: ToolCall = {
        id: toolCallId,
        name: toolName,
        args: data.args as Record<string, unknown> | undefined,
        status: "running",
        startedAt: Date.now(),
        insertedAtContentLength: run.content.length,
      };
      existingToolCalls.push(newToolCall);
      updateRunContent(runId, run.content, existingToolCalls);
      break;
    }

    case "update": {
      const idx = existingToolCalls.findIndex((tc) => tc.id === toolCallId);
      if (idx >= 0) {
        existingToolCalls[idx] = { ...existingToolCalls[idx], result: data.partialResult };
        updateRunContent(runId, run.content, existingToolCalls);
      }
      break;
    }

    case "result": {
      const idx = existingToolCalls.findIndex((tc) => tc.id === toolCallId);
      if (idx >= 0) {
        existingToolCalls[idx] = {
          ...existingToolCalls[idx],
          result: data.result,
          status: data.isError ? "error" : "complete",
          completedAt: Date.now(),
        };
        updateRunContent(runId, run.content, existingToolCalls);
      }
      break;
    }
  }
}

/**
 * Handle a chat event from the gateway.
 */
function handleChatEvent(event: ChatEvent): void {
  const { runId, state, message, errorMessage } = event;

  log.chat.debug("Chat event:", state, runId);

  switch (state) {
    case "delta":
      handleDeltaEvent(runId, message);
      break;

    case "final":
      handleFinalEvent(runId, message);
      break;

    case "aborted":
      abortRunSignal(runId);
      break;

    case "error":
      errorRun(runId, errorMessage ?? "Unknown error");
      break;
  }
}

/**
 * Handle streaming delta event.
 */
function handleDeltaEvent(runId: string, message?: ChatEvent["message"]): void {
  if (!message) return;

  const parsed = parseMessageContent(message.content);
  let existingRun = activeRuns.value.get(runId);

  // Debug: log what we're receiving
  console.log("[DELTA]", {
    runId,
    hasRun: !!existingRun,
    messageContent: message.content,
    parsedText: parsed.text.slice(0, 50),
    parsedToolCalls: parsed.toolCalls.map((tc) => ({ id: tc.id, name: tc.name, status: tc.status })),
  });

  // If no run exists (e.g., page refreshed mid-stream), create one on-the-fly
  if (!existingRun) {
    console.log("[DELTA] Creating run on-the-fly for:", runId);
    startRun(runId, "unknown"); // sessionKey unknown but not critical for streaming
    existingRun = activeRuns.value.get(runId);
    if (!existingRun) return; // shouldn't happen, but be safe
  }

  // Merge tool calls
  const mergedToolCalls = mergeToolCalls(existingRun.toolCalls, parsed.toolCalls);

  // Merge text content using the streaming helper
  const { content, lastBlockStart } = mergeDeltaText(
    existingRun.content,
    parsed.text,
    existingRun.lastBlockStart,
  );

  updateRunContent(runId, content, mergedToolCalls, lastBlockStart);
}

/**
 * Handle final message event.
 */
function handleFinalEvent(runId: string, message?: ChatEvent["message"]): void {
  const existingRun = activeRuns.value.get(runId);

  console.log("[FINAL]", {
    runId,
    hasRun: !!existingRun,
    existingToolCalls: existingRun?.toolCalls?.map((tc) => ({ id: tc.id, name: tc.name, status: tc.status })),
    messageContent: message?.content,
  });

  // Mark any still-running tool calls as complete (we may have missed result events after refresh)
  const finalToolCalls = existingRun?.toolCalls?.map((tc) => {
    if (tc.status === "running" || tc.status === "pending") {
      return { ...tc, status: "complete" as const, completedAt: Date.now() };
    }
    return tc;
  });

  // Build final message using accumulated content (gateway's final only has last block)
  const finalMessage: Message = {
    id: `assistant_${runId}`,
    role: "assistant",
    content: existingRun?.content ?? "",
    toolCalls: finalToolCalls?.length ? finalToolCalls : undefined,
    timestamp: message?.timestamp ?? Date.now(),
  };

  completeRun(runId, finalMessage);
}

// ============================================
// Initialization
// ============================================

export async function initChat(sessionKey: string): Promise<void> {
  subscribeToChatEvents();
  await loadHistory(sessionKey);
}

export function cleanupChat(): void {
  unsubscribeFromChatEvents();
  clearMessages();
}
