import { SAME_TURN_THRESHOLD_MS } from "@/lib/constants";
import { extractToolResultContent } from "@/lib/tool-utils";
import type { ChatHistoryResult } from "@/types/chat";
import { normalizeMessage } from "@/types/chat";
import type { Message } from "@/types/messages";

/**
 * Normalize raw chat history messages and attach separate toolResult messages
 * to their matching assistant tool calls.
 */
export function normalizeHistoryMessages(rawMessages: ChatHistoryResult["messages"]): Message[] {
  const toolResults = collectToolResults(rawMessages);
  const normalized: Message[] = [];

  for (let index = 0; index < rawMessages.length; index++) {
    const raw = rawMessages[index];

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

  return normalized;
}

/**
 * Collect tool results from raw messages into a lookup map.
 */
function collectToolResults(
  rawMessages: ChatHistoryResult["messages"],
): Map<string, { content: unknown; isError: boolean }> {
  const results = new Map<string, { content: unknown; isError: boolean }>();

  for (const raw of rawMessages) {
    if (raw.role === "toolResult" && raw.toolCallId) {
      results.set(raw.toolCallId, {
        content: extractToolResultContent(raw.content),
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

  // Preserve truncation metadata if any message in this merged turn was truncated in history
  if (curr.historyTruncated) {
    prev.historyTruncated = true;
    if (!prev.historyTruncationReason && curr.historyTruncationReason) {
      prev.historyTruncationReason = curr.historyTruncationReason;
    }
  }
}
