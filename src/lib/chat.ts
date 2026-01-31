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
  messages,
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
  markMessageQueued,
  saveCachedMessages,
  activeRuns,
  isStreaming,
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
    saveCachedMessages(sessionKey, normalized);

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

  // Determine initial status: queued if streaming, sending otherwise
  const initialStatus = isStreaming.value ? "queued" : "sending";

  if (!isRetry) {
    const userMessage: Message = {
      id: messageId,
      role: "user",
      content: message,
      timestamp: Date.now(),
      isStreaming: false,
      status: initialStatus,
      sessionKey,
    };
    addMessage(userMessage);
  } else {
    if (isStreaming.value) {
      markMessageQueued(messageId);
    } else {
      markMessageSending(messageId);
    }
  }

  // Queue if disconnected
  if (!isConnected.value) {
    log.chat.info("Not connected, queuing message");
    queueMessage({
      id: messageId,
      role: "user",
      content: message,
      timestamp: Date.now(),
      status: initialStatus,
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
 * Looks in both the message queue (for queued messages) and messages list (for failed sends).
 */
export async function retryMessage(messageId: string): Promise<void> {
  // First check the queue (for messages queued while disconnected)
  let message = messageQueue.value.find((m) => m.id === messageId);

  // If not in queue, check the messages list (for failed sends)
  if (!message) {
    message = messages.value.find((m) => m.id === messageId && m.status === "failed");
  }

  if (!message?.sessionKey) {
    log.chat.warn("Cannot retry message - not found or missing sessionKey:", messageId);
    return;
  }

  // Remove from queue if it was there
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

  // Helper to find or create a tool call entry
  const findOrCreateToolCall = (): number => {
    let idx = existingToolCalls.findIndex((tc) => tc.id === toolCallId);
    if (idx < 0) {
      // Tool call doesn't exist (missed 'start' event after refresh) - create it
      log.chat.debug("Creating missing tool call:", toolCallId);
      existingToolCalls.push({
        id: toolCallId,
        name: toolName,
        status: "running",
        startedAt: Date.now(),
        insertedAtContentLength: run.content.length,
        contentSnapshotAtStart: run.content,
      });
      idx = existingToolCalls.length - 1;
    }
    return idx;
  };

  switch (data.phase) {
    case "start": {
      // Avoid duplicates
      if (existingToolCalls.some((tc) => tc.id === toolCallId)) return;

      // Defer tool start processing to allow any pending text deltas to be processed first
      // This fixes race conditions where tool events arrive before text is fully updated
      setTimeout(() => {
        const currentRun = activeRuns.value.get(runId);
        if (!currentRun) return;

        const currentToolCalls = [...currentRun.toolCalls];
        // Check again for duplicates after defer
        if (currentToolCalls.some((tc) => tc.id === toolCallId)) return;

        const newToolCall: ToolCall = {
          id: toolCallId,
          name: toolName,
          args: data.args as Record<string, unknown> | undefined,
          status: "running",
          startedAt: Date.now(),
          insertedAtContentLength: currentRun.content.length,
          contentSnapshotAtStart: currentRun.content,
        };
        currentToolCalls.push(newToolCall);
        updateRunContent(runId, currentRun.content, currentToolCalls);
      }, 0);
      break;
    }

    case "update": {
      const idx = findOrCreateToolCall();
      existingToolCalls[idx] = { ...existingToolCalls[idx], result: data.partialResult };
      updateRunContent(runId, run.content, existingToolCalls);
      break;
    }

    case "result": {
      const idx = findOrCreateToolCall();
      existingToolCalls[idx] = {
        ...existingToolCalls[idx],
        result: data.result,
        status: data.isError ? "error" : "complete",
        completedAt: Date.now(),
      };
      updateRunContent(runId, run.content, existingToolCalls);
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

  // If no run exists (e.g., page refreshed mid-stream), create one on-the-fly
  if (!existingRun) {
    log.chat.debug("Creating run on-the-fly for delta:", runId);
    startRun(runId, "unknown");
    existingRun = activeRuns.value.get(runId);
    if (!existingRun) return;
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

  // Try to get complete content from the final message
  // The gateway may send complete content that's more accurate than our accumulated deltas
  let finalContent = existingRun?.content ?? "";
  let finalParsedToolCalls: ToolCall[] = [];

  if (message?.content) {
    const parsed = parseMessageContent(message.content);

    // If final message has complete content (with tool positions), use it
    // This is more reliable than accumulated deltas which may have race conditions
    if (parsed.text.length >= finalContent.length) {
      finalContent = parsed.text;
      finalParsedToolCalls = parsed.toolCalls;
    } else if (parsed.text) {
      // Otherwise merge the final text (likely just the last block after tools)
      const merged = mergeDeltaText(finalContent, parsed.text, existingRun?.lastBlockStart);
      finalContent = merged.content;
    }
  }

  // Build final tool calls list
  // Prefer positions from parsed final message (more accurate than streaming positions)
  const finalToolCalls = existingRun?.toolCalls?.map((tc) => {
    const updated = { ...tc };

    // Mark still-running tools as complete
    if (updated.status === "running" || updated.status === "pending") {
      updated.status = "complete";
      updated.completedAt = Date.now();
    }

    // Check if final message has better position info for this tool
    const parsedTc = finalParsedToolCalls.find((p) => p.id === tc.id);
    if (parsedTc?.insertedAtContentLength !== undefined) {
      updated.insertedAtContentLength = parsedTc.insertedAtContentLength;
    }

    // Clear snapshot to save memory
    delete updated.contentSnapshotAtStart;

    return updated;
  });

  const finalMessage: Message = {
    id: `assistant_${runId}`,
    role: "assistant",
    content: finalContent,
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
