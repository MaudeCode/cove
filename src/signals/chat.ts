/**
 * Chat Signals
 *
 * Reactive state for chat messages and streaming.
 *
 * Usage:
 *   import { messages, isStreaming } from '@/signals/chat'
 *
 *   // In components
 *   {messages.value.map(msg => <Message key={msg.id} message={msg} />)}
 *   {isStreaming.value && <StreamingMessage />}
 */

import { signal, computed, effect } from "@preact/signals";
import type { AttachmentPayload } from "@/types/attachments";
import type {
  CommentaryItem,
  Message,
  MessageImage,
  MessageStatus,
  ToolCall,
} from "@/types/messages";
import type { ChatRun } from "@/types/chat";
import {
  RUN_CLEANUP_DELAY_MS,
  RUN_ERROR_CLEANUP_DELAY_MS,
  RUN_ABORT_CLEANUP_DELAY_MS,
} from "@/lib/constants";
import { buildQueuedMessageAttachments } from "../lib/chat/attachments";
import { createDebouncedSignal } from "@/lib/debounced-signal";
import { isHeartbeatMessage } from "@/lib/message-detection";
import {
  getMessageQueue,
  getMessagesCache,
  setMessageQueue,
  setMessagesCache,
} from "@/lib/storage";
import { isForActiveSession } from "@/signals/sessions";

// ============================================
// Message Cache
// ============================================

/** Current cached session key */
let cachedSessionKey: string | null = null;

function loadCachedMessages(): Message[] {
  const cache = getMessagesCache();
  if (cache) {
    cachedSessionKey = cache.sessionKey;
    return cache.messages;
  }
  return [];
}

export function saveCachedMessages(sessionKey: string, msgs: Message[]): void {
  setMessagesCache(sessionKey, msgs);
  cachedSessionKey = sessionKey;
}

export function getCachedSessionKey(): string | null {
  return cachedSessionKey;
}

// ============================================
// Message State
// ============================================

/** All messages in the current session (initialized from cache) */
export const messages = signal<Message[]>(loadCachedMessages());

/** Whether we're currently loading history */
export const isLoadingHistory = signal<boolean>(false);

/** Error from loading history */
export const historyError = signal<string | null>(null);

/** Current thinking level for the session */
export const thinkingLevel = signal<string>("off");

/** Whether the session is currently being compacted */
export const isCompacting = signal<boolean>(false);
/** Summary text from the last completed compaction (current session only) */
export const lastCompactionSummary = signal<string | undefined>(undefined);
/** Whether we have a just-completed compaction to show (before it's in message history) */
export const showCompletedCompaction = signal<boolean>(false);
/** Message index where the completed compaction divider should be rendered */
export const compactionInsertIndex = signal<number>(-1);

// ============================================
// Heartbeat Tracking
// ============================================

/** Heartbeat messages in current session */
export const heartbeatMessages = computed(() => messages.value.filter(isHeartbeatMessage));

/** Count of heartbeat messages */
export const heartbeatCount = computed(() => heartbeatMessages.value.length);

// ============================================
// Search & Filter
// ============================================

/** Current search query (raw input) */
export const searchQuery = signal<string>("");

/** Debounced search query for filtering (300ms delay) */
export const debouncedSearchQuery = createDebouncedSignal(searchQuery, 300);

/** Whether search is active (panel open) */
export const isSearchOpen = signal<boolean>(false);

/** Message ID to scroll to (set when clicking a search result) */
export const scrollToMessageId = signal<string | null>(null);

/** Date range filter - start (inclusive) */
export const dateRangeStart = signal<Date | null>(null);

/** Date range filter - end (inclusive) */
export const dateRangeEnd = signal<Date | null>(null);

/** Whether date range filter is active */
export const hasDateFilter = computed(
  () => dateRangeStart.value !== null || dateRangeEnd.value !== null,
);

/** Clear date range filter */
export function clearDateFilter(): void {
  dateRangeStart.value = null;
  dateRangeEnd.value = null;
}

/** Filter messages by search query and date range */
export const filteredMessages = computed(() => {
  let result = messages.value;

  // Filter by date range
  const start = dateRangeStart.value;
  const end = dateRangeEnd.value;

  if (start || end) {
    result = result.filter((msg) => {
      const msgDate = new Date(msg.timestamp);
      if (start && msgDate < start) return false;
      if (end) {
        // End date is inclusive - include entire day
        const endOfDay = new Date(end);
        endOfDay.setHours(23, 59, 59, 999);
        if (msgDate > endOfDay) return false;
      }
      return true;
    });
  }

  // Filter by search query (use debounced query for performance during typing)
  const query = debouncedSearchQuery.value.trim().toLowerCase();
  if (query) {
    result = result.filter((msg) => msg.content.toLowerCase().includes(query));
  }

  return result;
});

/** Number of search matches (after date filter) */
export const searchMatchCount = computed(() => {
  const query = debouncedSearchQuery.value.trim().toLowerCase();
  if (!query && !hasDateFilter.value) {
    return 0;
  }
  return filteredMessages.value.length;
});

// ============================================
// Message Queue (for offline/failed messages)
// ============================================

/** Messages waiting to be sent (queued while disconnected) */
export const messageQueue = signal<Message[]>(getMessageQueue());

/** Whether we have queued messages */
export const hasQueuedMessages = computed(() => messageQueue.value.length > 0);

effect(() => {
  setMessageQueue(messageQueue.value);
});

// ============================================
// Streaming State
// ============================================

/** Active chat runs (keyed by runId) */
export const activeRuns = signal<Map<string, ChatRun>>(new Map());

/** Sessions where startup reported an active run before it exposed a run id. */
export const startupActiveRunSessions = signal<Set<string>>(new Set());

/** First active streaming run across sessions (derived from activeRuns) */
const currentStreamingRun = computed<ChatRun | null>(() => {
  for (const run of activeRuns.value.values()) {
    if (run.status === "pending" || run.status === "streaming") {
      return run;
    }
  }
  return null;
});

/** Global streaming flags/content derived from activeRuns (single source of truth) */
export const isStreaming = computed<boolean>(() => currentStreamingRun.value !== null);

/** Get the current streaming run for a session (if any) */
export function getStreamingRun(sessionKey: string): ChatRun | null {
  for (const run of activeRuns.value.values()) {
    if (run.sessionKey === sessionKey && (run.status === "pending" || run.status === "streaming")) {
      return run;
    }
  }
  return null;
}

export function hasStartupActiveRun(sessionKey: string): boolean {
  return startupActiveRunSessions.value.has(sessionKey);
}

export function markStartupActiveRun(sessionKey: string): void {
  if (startupActiveRunSessions.value.has(sessionKey)) return;
  startupActiveRunSessions.value = new Set([...startupActiveRunSessions.value, sessionKey]);
}

export function clearStartupActiveRun(sessionKey: string): void {
  if (!startupActiveRunSessions.value.has(sessionKey)) return;
  const next = new Set(startupActiveRunSessions.value);
  next.delete(sessionKey);
  startupActiveRunSessions.value = next;
}

/** Get streaming state for a specific session */
export function getStreamingStateForSession(sessionKey: string): {
  isStreaming: boolean;
  content: string;
  toolCalls: ToolCall[];
  commentaryItems: CommentaryItem[];
} {
  const run = getStreamingRun(sessionKey);
  if (run) {
    return {
      isStreaming: true,
      content: run.content,
      toolCalls: run.toolCalls,
      commentaryItems: run.commentaryItems ?? [],
    };
  }
  return {
    isStreaming: false,
    content: "",
    toolCalls: [],
    commentaryItems: [],
  };
}

// ============================================
// Internal Helpers
// ============================================

/**
 * Update a run in the activeRuns map (immutable update pattern).
 */
function updateRun(runId: string, updates: Partial<ChatRun>): void {
  const run = activeRuns.value.get(runId);
  if (!run) return;

  const newRuns = new Map(activeRuns.value);
  newRuns.set(runId, { ...run, ...updates });
  activeRuns.value = newRuns;
}

/**
 * Schedule cleanup of a run after a delay.
 */
function scheduleRunCleanup(runId: string, delayMs: number): void {
  setTimeout(() => {
    const runs = new Map(activeRuns.value);
    runs.delete(runId);
    activeRuns.value = runs;
  }, delayMs);
}

/**
 * Update message status by ID.
 */
function setMessageStatus(messageId: string, status: MessageStatus, error?: string): void {
  messages.value = messages.value.map((msg) =>
    msg.id === messageId ? { ...msg, status, error } : msg,
  );
}

// ============================================
// Message Actions
// ============================================

/** Clear all messages */
export function clearMessages(): void {
  messages.value = [];
  historyError.value = null;
}

/** Set messages (replaces all) — clears ephemeral compaction state since history has its own markers */
export function setMessages(newMessages: Message[]): void {
  messages.value = newMessages;
  showCompletedCompaction.value = false;
  lastCompactionSummary.value = undefined;
  compactionInsertIndex.value = -1;
}

/** Apply authoritative history while preserving unresolved local tail messages for the session. */
export function reconcileMessagesFromHistory(
  sessionKey: string,
  historyMessages: Message[],
  historyRequestedAt: number,
  options?: {
    preservePendingSteerRunIds?: Iterable<string>;
    preserveSessionPendingSteers?: boolean;
  },
): Message[] {
  const currentMessages = messages.value;
  const historyWithLocalRunActivity = mergeLocalRunActivityIntoHistory(
    historyMessages,
    currentMessages,
  );
  const optimisticTail = getOptimisticTailMessages(
    sessionKey,
    currentMessages,
    historyWithLocalRunActivity,
    historyRequestedAt,
  );
  const reconciled = [...historyWithLocalRunActivity, ...optimisticTail];
  setMessages(reconciled);
  pruneStalePendingSteerMessages(sessionKey, options);
  return reconciled;
}

function mergeLocalRunActivityIntoHistory(
  historyMessages: Message[],
  currentMessages: Message[],
): Message[] {
  const localActivityByHistoryIndex = getClosestLocalRunActivityMatches(
    historyMessages,
    currentMessages,
  );

  return historyMessages.map((historyMessage, historyIndex) => {
    const localIndex = localActivityByHistoryIndex.get(historyIndex);
    if (localIndex == null) return historyMessage;

    return mergeLocalRunActivity(historyMessage, currentMessages[localIndex]);
  });
}

function getClosestLocalRunActivityMatches(
  historyMessages: Message[],
  currentMessages: Message[],
): Map<number, number> {
  const candidates: Array<{ historyIndex: number; localIndex: number; distance: number }> = [];

  for (const [historyIndex, historyMessage] of historyMessages.entries()) {
    if (historyMessage.role !== "assistant") continue;

    for (const [localIndex, currentMessage] of currentMessages.entries()) {
      if (!hasLocalRunActivity(currentMessage)) continue;
      if (
        !isRepresentedByHistoryMessage(currentMessage, historyMessage, {
          allowToolCallMatch: true,
        })
      ) {
        continue;
      }

      candidates.push({
        historyIndex,
        localIndex,
        distance: Math.abs(historyMessage.timestamp - currentMessage.timestamp),
      });
    }
  }

  candidates.sort((left, right) => left.distance - right.distance);

  const usedHistoryIndexes = new Set<number>();
  const usedLocalIndexes = new Set<number>();
  const localActivityByHistoryIndex = new Map<number, number>();

  for (const candidate of candidates) {
    if (usedHistoryIndexes.has(candidate.historyIndex)) continue;
    if (usedLocalIndexes.has(candidate.localIndex)) continue;

    usedHistoryIndexes.add(candidate.historyIndex);
    usedLocalIndexes.add(candidate.localIndex);
    localActivityByHistoryIndex.set(candidate.historyIndex, candidate.localIndex);
  }

  return localActivityByHistoryIndex;
}

function hasLocalRunActivity(message: Message): boolean {
  if (message.role !== "assistant") return false;
  if (message.commentaryItems?.length) return true;
  if (message.runStartedAt != null || message.runCompletedAt != null) return true;
  if (message.toolCalls?.some((toolCall) => toolCall.seq != null)) return true;
  return false;
}

function mergeLocalRunActivity(historyMessage: Message, localMessage: Message): Message {
  return {
    ...historyMessage,
    commentaryItems: localMessage.commentaryItems?.length
      ? mergeCommentaryItems(historyMessage.commentaryItems, localMessage.commentaryItems)
      : historyMessage.commentaryItems,
    runStartedAt: historyMessage.runStartedAt ?? localMessage.runStartedAt,
    runCompletedAt: historyMessage.runCompletedAt ?? localMessage.runCompletedAt,
    toolCalls: mergeLocalToolCallMetadata(historyMessage.toolCalls, localMessage.toolCalls),
  };
}

function mergeLocalToolCallMetadata(
  historyToolCalls: ToolCall[] | undefined,
  localToolCalls: ToolCall[] | undefined,
): ToolCall[] | undefined {
  if (!localToolCalls?.length) return historyToolCalls;
  if (!historyToolCalls?.length) return localToolCalls;

  return historyToolCalls.map((historyToolCall) => {
    const localToolCall = localToolCalls.find((toolCall) => toolCall.id === historyToolCall.id);
    if (!localToolCall) return historyToolCall;

    return {
      ...historyToolCall,
      seq: historyToolCall.seq ?? localToolCall.seq,
    };
  });
}

/** Add a message to the list (deduplicates by ID) */
export function addMessage(message: Message): void {
  // Check for existing message with same ID
  const existingIdx = messages.value.findIndex((m) => m.id === message.id);
  if (existingIdx >= 0) {
    // Update existing message instead of adding duplicate
    messages.value = messages.value.map((m, idx) =>
      idx === existingIdx ? { ...m, ...message } : m,
    );
    return;
  }
  messages.value = [...messages.value, message];
}

const HISTORY_MATCH_WINDOW_MS = 120_000;

function getOptimisticTailMessages(
  sessionKey: string,
  currentMessages: Message[],
  historyMessages: Message[],
  historyRequestedAt: number,
): Message[] {
  const lastHistoryTimestamp = Math.max(0, ...historyMessages.map((msg) => msg.timestamp));

  return currentMessages.filter((message) => {
    if (message.sessionKey && message.sessionKey !== sessionKey) return false;
    if (isUnresolvedLocalMessage(message)) return true;
    if (isUnmatchedCommentaryOnlyRunActivity(message, historyMessages)) return true;
    if (message.timestamp < historyRequestedAt) return false;
    if (
      isRepeatedSentUserMessageAfterHistoryRequest(message, historyMessages, historyRequestedAt)
    ) {
      return true;
    }
    if (isRepresentedInHistory(message, historyMessages)) return false;
    if (isNewerLocalTailMessage(message, lastHistoryTimestamp)) return true;
    if (isBoundaryLocalTailMessage(message, lastHistoryTimestamp)) {
      return !isRepresentedInHistory(message, historyMessages);
    }
    return false;
  });
}

function isUnresolvedLocalMessage(message: Message): boolean {
  if (message.status === "sending" || message.status === "failed") return true;
  if (message.isStreaming) return true;
  return false;
}

function isUnmatchedCommentaryOnlyRunActivity(
  message: Message,
  historyMessages: Message[],
): boolean {
  if (message.role !== "assistant") return false;
  if (message.content.trim().length > 0) return false;
  if (!hasLocalRunActivity(message)) return false;

  return !historyMessages.some((historyMessage) =>
    isRepresentedByHistoryMessage(message, historyMessage, {
      allowToolCallMatch: true,
    }),
  );
}

function isRepeatedSentUserMessageAfterHistoryRequest(
  message: Message,
  historyMessages: Message[],
  historyRequestedAt: number,
): boolean {
  if (message.role !== "user" || message.status !== "sent") return false;
  if (message.timestamp <= historyRequestedAt) return false;
  if (hasSameOrNewerHistoryMessage(message, historyMessages)) return false;

  return historyMessages.some(
    (historyMessage) =>
      historyMessage.role === message.role &&
      historyMessage.content === message.content &&
      historyMessage.timestamp < message.timestamp,
  );
}

function hasSameOrNewerHistoryMessage(message: Message, historyMessages: Message[]): boolean {
  return historyMessages.some(
    (historyMessage) =>
      historyMessage.role === message.role &&
      historyMessage.content === message.content &&
      historyMessage.timestamp >= message.timestamp &&
      Math.abs(historyMessage.timestamp - message.timestamp) <= HISTORY_MATCH_WINDOW_MS,
  );
}

function isNewerLocalTailMessage(message: Message, lastHistoryTimestamp: number): boolean {
  if (message.status === "sent" && message.timestamp > lastHistoryTimestamp) {
    return true;
  }
  if (
    (message.id.startsWith("assistant_") || message.id.startsWith("side_")) &&
    message.timestamp > lastHistoryTimestamp
  ) {
    return true;
  }
  return false;
}

function isBoundaryLocalTailMessage(message: Message, lastHistoryTimestamp: number): boolean {
  if (message.timestamp !== lastHistoryTimestamp) return false;
  return (
    message.status === "sent" ||
    message.id.startsWith("assistant_") ||
    message.id.startsWith("side_")
  );
}

function isRepresentedInHistory(message: Message, historyMessages: Message[]): boolean {
  return historyMessages.some((historyMessage) =>
    isRepresentedByHistoryMessage(message, historyMessage),
  );
}

function isRepresentedByHistoryMessage(
  message: Message,
  historyMessage: Message,
  options?: { allowToolCallMatch?: boolean },
): boolean {
  if (historyMessage.role !== message.role) return false;
  if (Math.abs(historyMessage.timestamp - message.timestamp) > HISTORY_MATCH_WINDOW_MS) {
    return false;
  }
  if (historyMessage.content === message.content) return true;
  if (!options?.allowToolCallMatch) return false;
  return hasMatchingToolCall(message, historyMessage);
}

function hasMatchingToolCall(message: Message, historyMessage: Message): boolean {
  if (!message.toolCalls?.length || !historyMessage.toolCalls?.length) return false;
  const historyToolCallIds = new Set(historyMessage.toolCalls.map((toolCall) => toolCall.id));
  return message.toolCalls.some((toolCall) => historyToolCallIds.has(toolCall.id));
}

/** Mark a message as sending */
export function markMessageSending(messageId: string): void {
  setMessageStatus(messageId, "sending", undefined);
}

/** Mark a message as sent */
export function markMessageSent(messageId: string): void {
  setMessageStatus(messageId, "sent", undefined);
}

/** Mark a message as steered */
export function markMessageSteered(messageId: string): void {
  messages.value = messages.value.map((msg) =>
    msg.id === messageId ? { ...msg, status: "sent", error: undefined, steered: true } : msg,
  );
}

/** Mark a message as failed */
export function markMessageFailed(messageId: string, error: string): void {
  setMessageStatus(messageId, "failed", error);
}

// ============================================
// Run Lifecycle Actions
// ============================================

/** Start a new chat run */
export function startRun(runId: string, sessionKey: string): void {
  clearStartupActiveRun(sessionKey);
  const newRuns = new Map(activeRuns.value);
  newRuns.set(runId, {
    runId,
    sessionKey,
    startedAt: Date.now(),
    status: "pending",
    content: "",
    toolCalls: [],
    commentaryItems: [],
  });
  activeRuns.value = newRuns;
}

/** Ensure an active run exists without replacing live streamed content. */
export function ensureRun(runId: string, sessionKey: string): void {
  if (activeRuns.value.has(runId)) return;
  startRun(runId, sessionKey);
}

/** Adopt the gateway ACK runId for an optimistic local run. */
export function adoptRunId(optimisticRunId: string, gatewayRunId: string): void {
  if (optimisticRunId === gatewayRunId) return;

  const optimisticRun = activeRuns.value.get(optimisticRunId);
  if (!optimisticRun) return;

  const gatewayRun = activeRuns.value.get(gatewayRunId);
  const newRuns = new Map(activeRuns.value);
  newRuns.delete(optimisticRunId);

  if (gatewayRun) {
    newRuns.set(gatewayRunId, {
      ...optimisticRun,
      ...gatewayRun,
      runId: gatewayRunId,
      sessionKey: gatewayRun.sessionKey || optimisticRun.sessionKey,
      startedAt: Math.min(optimisticRun.startedAt, gatewayRun.startedAt),
      content: gatewayRun.content || optimisticRun.content,
      toolCalls: gatewayRun.toolCalls.length ? gatewayRun.toolCalls : optimisticRun.toolCalls,
      commentaryItems: mergeCommentaryItems(
        optimisticRun.commentaryItems,
        gatewayRun.commentaryItems ?? [],
      ),
      lastBlockStart: gatewayRun.lastBlockStart ?? optimisticRun.lastBlockStart,
    });
  } else {
    newRuns.set(gatewayRunId, {
      ...optimisticRun,
      runId: gatewayRunId,
    });
  }

  activeRuns.value = newRuns;
}

/** Update a chat run with streaming content and tool calls */
export function updateRunContent(
  runId: string,
  content: string,
  toolCalls: ToolCall[] = [],
  lastBlockStart?: number,
): void {
  const run = activeRuns.value.get(runId);
  if (!run) return;

  updateRun(runId, {
    status: "streaming",
    content,
    toolCalls,
    lastBlockStart: lastBlockStart ?? run.lastBlockStart,
  });
}

/** Upsert ephemeral commentary/progress without changing final assistant content. */
export function updateRunCommentaryItem(runId: string, item: CommentaryItem): void {
  const run = activeRuns.value.get(runId);
  if (!run) return;

  updateRun(runId, {
    status: "streaming",
    commentaryItems: mergeCommentaryItems(run.commentaryItems, [item]),
  });
}

/** Complete a chat run */
export function completeRun(runId: string, message?: Message): void {
  completeRunInternal(runId, message, { createCommentaryOnlyMessage: false });
}

/** Complete a chat run and intentionally persist commentary even without final content. */
export function completeRunWithCommentaryOnlyMessage(runId: string): void {
  completeRunInternal(runId, undefined, { createCommentaryOnlyMessage: true });
}

function completeRunInternal(
  runId: string,
  message: Message | undefined,
  options: { createCommentaryOnlyMessage: boolean },
): void {
  const run = activeRuns.value.get(runId);
  clearPendingSteerMessagesForRun(runId);

  const completedAt = Date.now();
  const completedMessage = withRunCommentaryItems(message, run, completedAt, options);

  // Update content from final message to avoid showing incomplete streamed content
  const finalContent = completedMessage?.content ?? run?.content ?? "";
  updateRun(runId, { status: "complete", message: completedMessage, content: finalContent });

  if (completedMessage) {
    // Only add message to global messages if this run belongs to the active session.
    // Messages from other sessions will be loaded from history when user switches to them.
    if (isForActiveSession(run?.sessionKey)) {
      // If run was created on-the-fly (after refresh), try to update existing message
      // instead of adding a duplicate
      if (run?.sessionKey === "unknown") {
        const updated = tryUpdateExistingMessage(completedMessage);
        if (!updated) {
          addMessage(completedMessage);
        }
      } else {
        addMessage(completedMessage);
      }
    }
  }

  scheduleRunCleanup(runId, RUN_CLEANUP_DELAY_MS);
}

function withRunCommentaryItems(
  message: Message | undefined,
  run: ChatRun | undefined,
  completedAt: number,
  options: { createCommentaryOnlyMessage: boolean },
): Message | undefined {
  const commentaryItems = run?.commentaryItems?.filter((item) => item.text.trim().length > 0);
  if (!commentaryItems?.length) return message;

  if (message) {
    return {
      ...message,
      commentaryItems: mergeCommentaryItems(message.commentaryItems, commentaryItems),
      runStartedAt: message.runStartedAt ?? run?.startedAt,
      runCompletedAt: message.runCompletedAt ?? completedAt,
    };
  }

  if (!options.createCommentaryOnlyMessage) return undefined;

  return {
    id: `assistant_${run?.runId ?? Date.now()}`,
    role: "assistant",
    content: "",
    commentaryItems,
    toolCalls: run?.toolCalls?.length ? run.toolCalls : undefined,
    timestamp: Date.now(),
    isStreaming: false,
    runStartedAt: run?.startedAt,
    runCompletedAt: completedAt,
  };
}

function mergeCommentaryItems(
  existing: CommentaryItem[] | undefined,
  incoming: CommentaryItem[],
): CommentaryItem[] {
  const merged = [...(existing ?? [])];

  for (const item of incoming) {
    const existingIndex = merged.findIndex((candidate) => isSameCommentaryItem(candidate, item));
    if (existingIndex >= 0) {
      merged[existingIndex] = mergeCommentaryItem(merged[existingIndex], item);
    } else {
      merged.push(item);
    }
  }

  return merged;
}

function isSameCommentaryItem(left: CommentaryItem, right: CommentaryItem): boolean {
  if (left.id === right.id) return true;
  return normalizeCommentaryText(left.text) === normalizeCommentaryText(right.text);
}

function mergeCommentaryItem(existing: CommentaryItem, incoming: CommentaryItem): CommentaryItem {
  if (existing.id === incoming.id) {
    return {
      ...incoming,
      seq: existing.seq,
    };
  }

  return {
    ...existing,
    text: incoming.text,
  };
}

function normalizeCommentaryText(text: string): string {
  return text.trim().replace(/\s+/gu, " ");
}

/**
 * Try to update an existing message from history that matches this one.
 * Used when completing a run that was created on-the-fly after page refresh.
 * Returns true if an existing message was updated.
 */
function tryUpdateExistingMessage(newMessage: Message): boolean {
  // Look for a recent assistant message with matching tool calls
  const existingMessages = messages.value;

  for (let i = existingMessages.length - 1; i >= 0; i--) {
    const existing = existingMessages[i];

    // Only check recent assistant messages
    if (existing.role !== "assistant") continue;
    if (Date.now() - existing.timestamp > 60000) break; // Only check last minute

    // Check if tool calls match by ID
    if (newMessage.toolCalls && existing.toolCalls) {
      const newToolIds = new Set(newMessage.toolCalls.map((tc) => tc.id));
      const hasMatchingTool = existing.toolCalls.some((tc) => newToolIds.has(tc.id));

      if (hasMatchingTool) {
        // Merge tool calls: update status of existing ones
        const mergedToolCalls = existing.toolCalls.map((existingTc) => {
          const newTc = newMessage.toolCalls?.find((tc) => tc.id === existingTc.id);
          if (newTc) {
            return {
              ...existingTc,
              status: newTc.status,
              result: newTc.result,
              seq: newTc.seq ?? existingTc.seq,
              completedAt: newTc.completedAt,
            };
          }
          return existingTc;
        });

        // Merge content: keep existing content, append new content
        let mergedContent = existing.content;
        if (newMessage.content && !existing.content.endsWith(newMessage.content)) {
          const separator = existing.content ? "\n\n" : "";
          mergedContent = existing.content + separator + newMessage.content;
        }

        messages.value = existingMessages.map((msg) =>
          msg.id === existing.id
            ? {
                ...msg,
                content: mergedContent,
                toolCalls: mergedToolCalls,
                commentaryItems: newMessage.commentaryItems?.length
                  ? mergeCommentaryItems(existing.commentaryItems, newMessage.commentaryItems)
                  : existing.commentaryItems,
                runStartedAt: newMessage.runStartedAt ?? existing.runStartedAt,
                runCompletedAt: newMessage.runCompletedAt ?? existing.runCompletedAt,
              }
            : msg,
        );
        return true;
      }
    }
  }

  return false;
}

/** Mark a run as errored */
export function errorRun(runId: string, error: string): void {
  clearPendingSteerMessagesForRun(runId);
  updateRun(runId, { status: "error", error });
  scheduleRunCleanup(runId, RUN_ERROR_CLEANUP_DELAY_MS);
}

/** Mark a run as aborted */
export function abortRun(runId: string): void {
  clearPendingSteerMessagesForRun(runId);
  updateRun(runId, { status: "aborted" });
  scheduleRunCleanup(runId, RUN_ABORT_CLEANUP_DELAY_MS);
}

/** Clear all active runs (used on reconnect when gateway state is lost) */
export function clearActiveRuns(): void {
  activeRuns.value = new Map();
  startupActiveRunSessions.value = new Set();
}

// ============================================
// Queue Actions
// ============================================

/** Add a message to the queue (for sending when reconnected) */
export function queueMessage(message: Message): void {
  messageQueue.value = [...messageQueue.value, message];
}

/** Remove a message from the queue */
export function dequeueMessage(messageId: string): void {
  messageQueue.value = messageQueue.value.filter((m) => m.id !== messageId);
}

/** Update queue metadata without changing content or attachments. */
export function updateQueuedMessageState(messageId: string, updates: Partial<Message>): void {
  messageQueue.value = messageQueue.value.map((m) =>
    m.id === messageId ? { ...m, ...updates } : m,
  );
}

/** Remove pending steering indicators once their active run finishes. */
export function clearPendingSteerMessagesForRun(runId: string | undefined): void {
  if (!runId) return;
  messageQueue.value = messageQueue.value.filter(
    (m) => !(m.queueKind === "steered" && m.pendingRunId === runId),
  );
}

/** Drop persisted steering indicators whose run was already gone by history catch-up. */
function pruneStalePendingSteerMessages(
  sessionKey: string,
  options?: {
    preservePendingSteerRunIds?: Iterable<string>;
    preserveSessionPendingSteers?: boolean;
  },
): void {
  const activeRunIds = new Set(activeRuns.value.keys());
  const preservedRunIds = new Set(options?.preservePendingSteerRunIds ?? []);
  messageQueue.value = messageQueue.value.filter((m) => {
    if (m.sessionKey !== sessionKey) return true;
    if (m.queueKind !== "steered" || !m.pendingRunId) return true;
    if (options?.preserveSessionPendingSteers) return true;
    if (preservedRunIds.has(m.pendingRunId)) return true;
    return activeRunIds.has(m.pendingRunId);
  });
}

/** Update a queued message's content and/or images */
export function updateQueuedMessage(
  messageId: string,
  newContent: string,
  newImages?: MessageImage[],
  newPendingAttachments?: AttachmentPayload[],
): void {
  messageQueue.value = messageQueue.value.map((m) => {
    if (m.id !== messageId) return m;

    const pendingAttachments =
      newPendingAttachments ??
      (newImages !== undefined ? buildQueuedMessageAttachments(m, newImages) : undefined);

    return {
      ...m,
      content: newContent,
      ...(newImages !== undefined ? { images: newImages } : {}),
      ...(pendingAttachments !== undefined ? { pendingAttachments } : {}),
    };
  });
}

// ============================================
// Draft Persistence
// ============================================

/** Chat input drafts keyed by session key (persists across navigation) */
export const chatDrafts = signal<Map<string, string>>(new Map());

/** Get draft for a session */
export function getDraft(sessionKey: string): string {
  return chatDrafts.value.get(sessionKey) || "";
}

/** Set draft for a session */
export function setDraft(sessionKey: string, text: string): void {
  const drafts = new Map(chatDrafts.value);
  if (text) {
    drafts.set(sessionKey, text);
  } else {
    drafts.delete(sessionKey);
  }
  chatDrafts.value = drafts;
}

/** Clear draft for a session (call after sending) */
export function clearDraft(sessionKey: string): void {
  setDraft(sessionKey, "");
}
