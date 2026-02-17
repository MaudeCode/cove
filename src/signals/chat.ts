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

import { signal, computed } from "@preact/signals";
import type { Message, MessageImage, MessageStatus, ToolCall } from "@/types/messages";
import type { ChatRun } from "@/types/chat";
import {
  RUN_CLEANUP_DELAY_MS,
  RUN_ERROR_CLEANUP_DELAY_MS,
  RUN_ABORT_CLEANUP_DELAY_MS,
} from "@/lib/constants";
import { createDebouncedSignal } from "@/lib/debounced-signal";
import { isHeartbeatMessage } from "@/lib/message-detection";
import { getMessagesCache, setMessagesCache } from "@/lib/storage";
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
export const messageQueue = signal<Message[]>([]);

/** Whether we have queued messages */
export const hasQueuedMessages = computed(() => messageQueue.value.length > 0);

// ============================================
// Streaming State
// ============================================

/** Active chat runs (keyed by runId) */
export const activeRuns = signal<Map<string, ChatRun>>(new Map());

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

/** Get streaming state for a specific session */
export function getStreamingStateForSession(sessionKey: string): {
  isStreaming: boolean;
  content: string;
  toolCalls: ToolCall[];
} {
  const run = getStreamingRun(sessionKey);
  if (run) {
    return {
      isStreaming: true,
      content: run.content,
      toolCalls: run.toolCalls,
    };
  }
  return {
    isStreaming: false,
    content: "",
    toolCalls: [],
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

/** Mark a message as sending */
export function markMessageSending(messageId: string): void {
  setMessageStatus(messageId, "sending", undefined);
}

/** Mark a message as sent */
export function markMessageSent(messageId: string): void {
  setMessageStatus(messageId, "sent", undefined);
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
  const newRuns = new Map(activeRuns.value);
  newRuns.set(runId, {
    runId,
    sessionKey,
    startedAt: Date.now(),
    status: "pending",
    content: "",
    toolCalls: [],
  });
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

/** Complete a chat run */
export function completeRun(runId: string, message?: Message): void {
  const run = activeRuns.value.get(runId);
  // Update content from final message to avoid showing incomplete streamed content
  const finalContent = message?.content ?? run?.content ?? "";
  updateRun(runId, { status: "complete", message, content: finalContent });

  if (message) {
    // Only add message to global messages if this run belongs to the active session.
    // Messages from other sessions will be loaded from history when user switches to them.
    if (isForActiveSession(run?.sessionKey)) {
      // If run was created on-the-fly (after refresh), try to update existing message
      // instead of adding a duplicate
      if (run?.sessionKey === "unknown") {
        const updated = tryUpdateExistingMessage(message);
        if (!updated) {
          addMessage(message);
        }
      } else {
        addMessage(message);
      }
    }
  }

  scheduleRunCleanup(runId, RUN_CLEANUP_DELAY_MS);
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
            ? { ...msg, content: mergedContent, toolCalls: mergedToolCalls }
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
  updateRun(runId, { status: "error", error });
  scheduleRunCleanup(runId, RUN_ERROR_CLEANUP_DELAY_MS);
}

/** Mark a run as aborted */
export function abortRun(runId: string): void {
  updateRun(runId, { status: "aborted" });
  scheduleRunCleanup(runId, RUN_ABORT_CLEANUP_DELAY_MS);
}

/** Clear all active runs (used on reconnect when gateway state is lost) */
export function clearActiveRuns(): void {
  activeRuns.value = new Map();
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

/** Update a queued message's content and/or images */
export function updateQueuedMessage(
  messageId: string,
  newContent: string,
  newImages?: MessageImage[],
): void {
  messageQueue.value = messageQueue.value.map((m) =>
    m.id === messageId ? { ...m, content: newContent, images: newImages } : m,
  );
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
