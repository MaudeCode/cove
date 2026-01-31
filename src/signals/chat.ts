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

/** Whether any message is currently streaming */
export const isStreaming = computed(() => {
  for (const run of activeRuns.value.values()) {
    if (run.status === "pending" || run.status === "streaming") {
      return true;
    }
  }
  return false;
});

/** Get the current streaming run for a session (if any) */
export function getStreamingRun(sessionKey: string): ChatRun | null {
  for (const run of activeRuns.value.values()) {
    if (run.sessionKey === sessionKey && (run.status === "pending" || run.status === "streaming")) {
      return run;
    }
  }
  return null;
}

/** Text content being streamed (for display) */
export const streamingContent = computed(() => {
  for (const run of activeRuns.value.values()) {
    if (run.status === "streaming" || run.status === "pending") {
      return run.content;
    }
  }
  return "";
});

/** Tool calls being streamed (for display) */
export const streamingToolCalls = computed((): ToolCall[] => {
  for (const run of activeRuns.value.values()) {
    if (run.status === "streaming" || run.status === "pending") {
      return run.toolCalls;
    }
  }
  return [];
});

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
  console.log("[SIGNAL] Run started, activeRuns keys:", Array.from(activeRuns.value.keys()));
}

/**
 * Update a chat run with streaming content and tool calls
 */
export function updateRunContent(runId: string, content: string, toolCalls: ToolCall[] = []): void {
  const run = activeRuns.value.get(runId);
  console.log("[SIGNAL] updateRunContent called", { runId, contentLen: content.length, hasRun: !!run });
  if (!run) {
    console.log("[SIGNAL] No run found! Active runs:", Array.from(activeRuns.value.keys()));
    return;
  }

  const newRuns = new Map(activeRuns.value);
  newRuns.set(runId, {
    ...run,
    status: "streaming",
    content,
    toolCalls,
  });
  activeRuns.value = newRuns;
  console.log("[SIGNAL] Updated activeRuns, streamingContent should be:", content.slice(0, 50));
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

  // Add the final message to the list
  if (message) {
    addMessage(message);
  }

  // Clean up the run after a short delay
  setTimeout(() => {
    const runs = new Map(activeRuns.value);
    runs.delete(runId);
    activeRuns.value = runs;
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

  // Clean up after delay
  setTimeout(() => {
    const runs = new Map(activeRuns.value);
    runs.delete(runId);
    activeRuns.value = runs;
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

  // Clean up after delay
  setTimeout(() => {
    const runs = new Map(activeRuns.value);
    runs.delete(runId);
    activeRuns.value = runs;
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
