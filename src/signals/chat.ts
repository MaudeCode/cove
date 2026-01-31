/**
 * Chat Signals
 *
 * Reactive state for chat messages and streaming.
 *
 * Usage:
 *   import { messages, isStreaming, streamingContent, streamingToolCalls } from '@/signals/chat'
 *
 *   // In components
 *   {messages.value.map(msg => <Message key={msg.id} message={msg} />)}
 *   {isStreaming.value && <StreamingMessage content={streamingContent.value} toolCalls={streamingToolCalls.value} />}
 */

import { signal, computed } from "@preact/signals";
import type { Message, MessageStatus, ToolCall } from "@/types/messages";
import type { ChatRun } from "@/types/chat";
import {
  RUN_CLEANUP_DELAY_MS,
  RUN_ERROR_CLEANUP_DELAY_MS,
  RUN_ABORT_CLEANUP_DELAY_MS,
} from "@/lib/constants";

// ============================================
// Message Cache
// ============================================

const MESSAGES_CACHE_KEY = "cove:messages-cache";
const MESSAGES_SESSION_KEY = "cove:messages-session";

/** Current cached session key */
let cachedSessionKey: string | null = null;

function loadCachedMessages(): Message[] {
  try {
    cachedSessionKey = localStorage.getItem(MESSAGES_SESSION_KEY);
    const cached = localStorage.getItem(MESSAGES_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    // Ignore
  }
  return [];
}

export function saveCachedMessages(sessionKey: string, msgs: Message[]): void {
  try {
    localStorage.setItem(MESSAGES_SESSION_KEY, sessionKey);
    localStorage.setItem(MESSAGES_CACHE_KEY, JSON.stringify(msgs));
    cachedSessionKey = sessionKey;
  } catch {
    // Ignore
  }
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

/** Direct signals for streaming state (more reliable than computed with Maps) */
export const isStreaming = signal<boolean>(false);
export const streamingContent = signal<string>("");
export const streamingToolCalls = signal<ToolCall[]>([]);

/** Get the current streaming run for a session (if any) */
export function getStreamingRun(sessionKey: string): ChatRun | null {
  for (const run of activeRuns.value.values()) {
    if (run.sessionKey === sessionKey && (run.status === "pending" || run.status === "streaming")) {
      return run;
    }
  }
  return null;
}

// ============================================
// Internal Helpers
// ============================================

/**
 * Update the streaming display signals from activeRuns.
 * Called after every run state change.
 */
function syncStreamingSignals(): void {
  let foundStreaming = false;
  for (const run of activeRuns.value.values()) {
    if (run.status === "pending" || run.status === "streaming") {
      foundStreaming = true;
      streamingContent.value = run.content;
      streamingToolCalls.value = run.toolCalls;
      break;
    }
  }
  if (!foundStreaming) {
    streamingContent.value = "";
    streamingToolCalls.value = [];
  }
  isStreaming.value = foundStreaming;
}

/**
 * Update a run in the activeRuns map (immutable update pattern).
 */
function updateRun(runId: string, updates: Partial<ChatRun>): void {
  const run = activeRuns.value.get(runId);
  if (!run) return;

  const newRuns = new Map(activeRuns.value);
  newRuns.set(runId, { ...run, ...updates });
  activeRuns.value = newRuns;
  syncStreamingSignals();
}

/**
 * Schedule cleanup of a run after a delay.
 */
function scheduleRunCleanup(runId: string, delayMs: number): void {
  setTimeout(() => {
    const runs = new Map(activeRuns.value);
    runs.delete(runId);
    activeRuns.value = runs;
    syncStreamingSignals();
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

/** Set messages (replaces all) */
export function setMessages(newMessages: Message[]): void {
  messages.value = newMessages;
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

/** Update an existing message by ID */
export function updateMessage(id: string, updates: Partial<Message>): void {
  messages.value = messages.value.map((msg) => (msg.id === id ? { ...msg, ...updates } : msg));
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
  syncStreamingSignals();
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
  updateRun(runId, { status: "complete", message });

  if (message) {
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

/** Clear the message queue */
export function clearQueue(): void {
  messageQueue.value = [];
}
