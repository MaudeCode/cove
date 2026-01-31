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
// Message State
// ============================================

/** All messages in the current session */
export const messages = signal<Message[]>([]);

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
function setMessageStatus(
  messageId: string,
  status: MessageStatus,
  error?: string,
): void {
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

/** Add a message to the list */
export function addMessage(message: Message): void {
  messages.value = [...messages.value, message];
}

/** Update an existing message by ID */
export function updateMessage(id: string, updates: Partial<Message>): void {
  messages.value = messages.value.map((msg) =>
    msg.id === id ? { ...msg, ...updates } : msg,
  );
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
  updateRun(runId, { status: "complete", message });

  if (message) {
    addMessage(message);
  }

  scheduleRunCleanup(runId, RUN_CLEANUP_DELAY_MS);
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
