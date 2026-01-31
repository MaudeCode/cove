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
import type { Message, ToolCall } from "@/types/messages";
import type { ChatRun } from "@/types/chat";

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

/** Update the streaming display signals from activeRuns */
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
  console.log("[SIGNAL] syncStreamingSignals:", {
    isStreaming: isStreaming.value,
    contentLen: streamingContent.value.length,
  });
}

// ============================================
// Actions
// ============================================

/**
 * Clear all messages
 */
export function clearMessages(): void {
  messages.value = [];
  historyError.value = null;
}

/**
 * Set messages (replaces all)
 */
export function setMessages(newMessages: Message[]): void {
  messages.value = newMessages;
}

/**
 * Add a message to the list
 */
export function addMessage(message: Message): void {
  messages.value = [...messages.value, message];
}

/**
 * Update an existing message by ID
 */
export function updateMessage(id: string, updates: Partial<Message>): void {
  messages.value = messages.value.map((msg) => (msg.id === id ? { ...msg, ...updates } : msg));
}

/**
 * Start a new chat run
 */
export function startRun(runId: string, sessionKey: string): void {
  console.log("[SIGNAL] startRun called", { runId, sessionKey });
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
  console.log("[SIGNAL] Run started, activeRuns keys:", Array.from(activeRuns.value.keys()));
}

/**
 * Update a chat run with streaming content and tool calls
 */
export function updateRunContent(
  runId: string,
  content: string,
  toolCalls: ToolCall[] = [],
  lastBlockStart?: number,
): void {
  const run = activeRuns.value.get(runId);
  if (!run) {
    return;
  }

  const newRuns = new Map(activeRuns.value);
  newRuns.set(runId, {
    ...run,
    status: "streaming",
    content,
    toolCalls,
    lastBlockStart: lastBlockStart ?? run.lastBlockStart,
  });
  activeRuns.value = newRuns;
  syncStreamingSignals();
}

/**
 * Complete a chat run
 */
export function completeRun(runId: string, message?: Message): void {
  const run = activeRuns.value.get(runId);
  if (!run) return;

  const newRuns = new Map(activeRuns.value);
  newRuns.set(runId, {
    ...run,
    status: "complete",
    message,
  });
  activeRuns.value = newRuns;
  syncStreamingSignals();

  // Add the final message to the list
  if (message) {
    addMessage(message);
  }

  // Clean up the run after a short delay
  setTimeout(() => {
    const runs = new Map(activeRuns.value);
    runs.delete(runId);
    activeRuns.value = runs;
    syncStreamingSignals();
  }, 100);
}

/**
 * Mark a run as errored
 */
export function errorRun(runId: string, error: string): void {
  const run = activeRuns.value.get(runId);
  if (!run) return;

  const newRuns = new Map(activeRuns.value);
  newRuns.set(runId, {
    ...run,
    status: "error",
    error,
  });
  activeRuns.value = newRuns;
  syncStreamingSignals();

  // Clean up after delay
  setTimeout(() => {
    const runs = new Map(activeRuns.value);
    runs.delete(runId);
    activeRuns.value = runs;
    syncStreamingSignals();
  }, 5000);
}

/**
 * Mark a run as aborted
 */
export function abortRun(runId: string): void {
  const run = activeRuns.value.get(runId);
  if (!run) return;

  const newRuns = new Map(activeRuns.value);
  newRuns.set(runId, {
    ...run,
    status: "aborted",
  });
  activeRuns.value = newRuns;
  syncStreamingSignals();

  // Clean up after delay
  setTimeout(() => {
    const runs = new Map(activeRuns.value);
    runs.delete(runId);
    activeRuns.value = runs;
    syncStreamingSignals();
  }, 1000);
}

// ============================================
// Queue Actions
// ============================================

/**
 * Add a message to the queue (for sending when reconnected)
 */
export function queueMessage(message: Message): void {
  messageQueue.value = [...messageQueue.value, message];
}

/**
 * Remove a message from the queue
 */
export function dequeueMessage(messageId: string): void {
  messageQueue.value = messageQueue.value.filter((m) => m.id !== messageId);
}

/**
 * Clear the message queue
 */
export function clearQueue(): void {
  messageQueue.value = [];
}

/**
 * Mark a message as failed
 */
export function markMessageFailed(messageId: string, error: string): void {
  messages.value = messages.value.map((msg) =>
    msg.id === messageId ? { ...msg, status: "failed" as const, error } : msg,
  );
}

/**
 * Mark a message as sending
 */
export function markMessageSending(messageId: string): void {
  messages.value = messages.value.map((msg) =>
    msg.id === messageId ? { ...msg, status: "sending" as const, error: undefined } : msg,
  );
}

/**
 * Mark a message as sent
 */
export function markMessageSent(messageId: string): void {
  messages.value = messages.value.map((msg) =>
    msg.id === messageId ? { ...msg, status: "sent" as const, error: undefined } : msg,
  );
}
