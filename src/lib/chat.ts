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
import type { Message, ToolCall } from "@/types/messages";
import type { ChatHistoryResult, ChatSendResult, ChatEvent, AgentEvent } from "@/types/chat";
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
    // Also pair toolResult messages with their corresponding tool calls
    const toolResults = new Map<string, { content: unknown; isError: boolean }>();

    // First pass: collect tool results
    for (const raw of result.messages) {
      if (raw.role === "toolResult" && raw.toolCallId) {
        const resultContent =
          Array.isArray(raw.content) && raw.content[0]?.type === "text"
            ? raw.content[0].text
            : raw.content;
        toolResults.set(raw.toolCallId, {
          content: resultContent,
          isError: raw.isError ?? false,
        });
      }
    }

    // Second pass: normalize messages and attach tool results
    const normalized: Message[] = [];
    for (let index = 0; index < result.messages.length; index++) {
      const raw = result.messages[index];

      // Skip toolResult messages - they're merged into assistant messages
      if (raw.role === "toolResult") continue;

      const msg = normalizeMessage(raw, `hist_${index}_${Date.now()}`);

      // Attach results to tool calls
      if (msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          const tcResult = toolResults.get(tc.id);
          if (tcResult) {
            tc.result = tcResult.content;
            tc.status = tcResult.isError ? "error" : "complete";
            tc.completedAt = Date.now();
          }
        }
      }

      // Merge consecutive assistant messages (same turn split across API calls)
      const prev = normalized[normalized.length - 1];
      if (
        prev &&
        prev.role === "assistant" &&
        msg.role === "assistant" &&
        Math.abs(msg.timestamp - prev.timestamp) < 60000 // Within 1 minute = same turn
      ) {
        // Merge tool calls
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          prev.toolCalls = [...(prev.toolCalls ?? []), ...msg.toolCalls];
        }
        // Merge content (append with newline if both have content)
        if (msg.content) {
          prev.content = prev.content ? `${prev.content}\n\n${msg.content}` : msg.content;
        }
        // Update timestamp to latest
        prev.timestamp = Math.max(prev.timestamp, msg.timestamp);
        continue; // Don't add as separate message
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

  // Also subscribe to agent events for tool calls
  on("agent", (payload) => {
    const evt = payload as AgentEvent;
    if (evt.stream === "tool") {
      console.log("[AGENT] Tool event:", evt.data);
      handleToolEvent(evt);
    }
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
 * Handle a tool event from the agent stream
 */
function handleToolEvent(evt: AgentEvent): void {
  const { runId, data } = evt;
  if (!data) return;

  const run = activeRuns.value.get(runId);
  if (!run) {
    console.log("[TOOL] No run found for tool event:", runId);
    return;
  }

  const toolCallId = data.toolCallId ?? `tool_${Date.now()}`;
  const toolName = data.name ?? "unknown";

  // Get existing tool calls (make a copy)
  const existingToolCalls = [...run.toolCalls];

  console.log(
    `[TOOL] ${data.phase}: ${toolName} (${toolCallId}) - existing tools:`,
    existingToolCalls.map((tc) => tc.id),
  );

  switch (data.phase) {
    case "start": {
      // Check if already exists (avoid duplicates)
      const existingIdx = existingToolCalls.findIndex((tc) => tc.id === toolCallId);
      if (existingIdx >= 0) {
        console.log("[TOOL] Skipping duplicate start for:", toolCallId);
        return;
      }
      // Add new tool call with running status
      const newToolCall: ToolCall = {
        id: toolCallId,
        name: toolName,
        args: data.args as Record<string, unknown> | undefined,
        status: "running",
        startedAt: Date.now(),
      };
      existingToolCalls.push(newToolCall);
      updateRunContent(runId, run.content, existingToolCalls);
      break;
    }

    case "update": {
      // Update partial result (not commonly used, but handle it)
      const idx = existingToolCalls.findIndex((tc) => tc.id === toolCallId);
      if (idx >= 0) {
        existingToolCalls[idx] = {
          ...existingToolCalls[idx],
          result: data.partialResult,
        };
        updateRunContent(runId, run.content, existingToolCalls);
      } else {
        console.log("[TOOL] No tool found for update:", toolCallId);
      }
      break;
    }

    case "result": {
      // Mark tool call as complete
      const idx = existingToolCalls.findIndex((tc) => tc.id === toolCallId);
      console.log(`[TOOL] Result for ${toolCallId}, found at idx:`, idx);
      if (idx >= 0) {
        existingToolCalls[idx] = {
          ...existingToolCalls[idx],
          result: data.result,
          status: data.isError ? "error" : "complete",
          completedAt: Date.now(),
        };
        updateRunContent(runId, run.content, existingToolCalls);
      } else {
        console.log("[TOOL] No tool found for result:", toolCallId);
      }
      break;
    }
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
        const existingContent = existingRun?.content ?? "";
        const lastBlockStart = existingRun?.lastBlockStart ?? 0;

        // Merge tool calls with existing ones (to track status changes)
        const mergedToolCalls = existingRun
          ? mergeToolCalls(existingRun.toolCalls, parsed.toolCalls)
          : parsed.toolCalls;

        // Determine if this is a continuation or new text block
        // Gateway sends accumulated text per-block, resetting after tool calls
        let newContent: string;
        let newBlockStart: number | undefined;
        let reason = "";

        if (!existingContent) {
          // First content
          newContent = parsed.text;
          reason = "first";
        } else if (parsed.text.startsWith(existingContent)) {
          // Direct continuation of existing (same block, no tool call in between)
          newContent = parsed.text;
          reason = "direct-continuation";
        } else if (lastBlockStart > 0) {
          // We previously appended a block - check if this continues that block
          const baseContent = existingContent.slice(0, lastBlockStart);
          const lastBlock = existingContent.slice(lastBlockStart);

          console.log("[DELTA] lastBlockStart check:", {
            lastBlockStart,
            baseLen: baseContent.length,
            lastBlockLen: lastBlock.length,
            newTextLen: parsed.text.length,
          });
          console.log("[DELTA] lastBlock:", lastBlock.slice(0, 50));
          console.log("[DELTA] newText:", parsed.text.slice(0, 50));

          if (parsed.text.startsWith(lastBlock)) {
            // Continuation of the last appended block - replace the block portion
            newContent = baseContent + parsed.text;
            reason = "continues-last-block";
          } else if (lastBlock.length > 0 && parsed.text.length > lastBlock.length) {
            // New text is longer and might be a continuation
            // Check if the last block is a prefix of new text
            if (parsed.text.startsWith(lastBlock.slice(0, Math.min(lastBlock.length, 30)))) {
              newContent = baseContent + parsed.text;
              reason = "continues-last-block-prefix";
            } else {
              // Truly new block
              newContent = existingContent + "\n\n" + parsed.text;
              newBlockStart = existingContent.length + 2;
              reason = "new-block-3";
            }
          } else {
            // Unclear - treat as continuation of last block
            newContent = baseContent + parsed.text;
            reason = "unclear-assume-continue";
          }
        } else {
          // No lastBlockStart but content doesn't continue - new block after tool
          newContent = existingContent + "\n\n" + parsed.text;
          newBlockStart = existingContent.length + 2;
          reason = "new-block-no-lastBlockStart";
          console.log("[DELTA] APPENDING - setting lastBlockStart to:", newBlockStart);
        }

        console.log("[DELTA]", {
          reason,
          existingLen: existingContent.length,
          newLen: newContent.length,
          lastBlockStart,
          newBlockStart,
        });
        updateRunContent(runId, newContent, mergedToolCalls, newBlockStart);
      }
      break;
    }

    case "final": {
      // Message complete - use our accumulated content (gateway's final only has last block)
      const existingRun = activeRuns.value.get(runId);
      const streamedToolCalls = existingRun?.toolCalls ?? [];
      const accumulatedContent = existingRun?.content ?? "";

      // Build final message using our accumulated content (which includes all text blocks)
      const finalMessage: Message = {
        id: `assistant_${runId}`,
        role: "assistant",
        content: accumulatedContent,
        toolCalls: streamedToolCalls.length > 0 ? streamedToolCalls : undefined,
        timestamp: message?.timestamp ?? Date.now(),
      };

      completeRun(runId, finalMessage);
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
