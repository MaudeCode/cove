/* eslint-disable no-unused-vars */
/**
 * Chat History
 *
 * Loading and processing chat history from the gateway.
 */

import { send } from "@/lib/gateway";
import { DEFAULT_HISTORY_LIMIT, SAME_TURN_THRESHOLD_MS } from "@/lib/constants";
import {
  isLoadingHistory,
  historyError,
  thinkingLevel,
  setMessages,
  clearMessages,
  saveCachedMessages,
} from "@/signals/chat";
import type { Message } from "@/types/messages";
import type { ChatHistoryResult } from "@/types/chat";
import { normalizeMessage } from "@/types/chat";

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
async function reloadHistory(sessionKey: string): Promise<void> {
  clearMessages();
  await loadHistory(sessionKey);
}
