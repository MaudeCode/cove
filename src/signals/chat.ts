/**
 * Chat Signals
 *
 * Reactive state for chat messages and streaming.
 *
 * Usage:
 *   import { messages, isStreaming, streamingContent } from '@/signals/chat'
 *
 *   // In components
 *   {messages.value.map(msg => <Message key={msg.id} message={msg} />)}
 *   {isStreaming.value && <StreamingIndicator content={streamingContent.value} />}
 */

import { signal, computed } from "@preact/signals";
import type { Message } from "@/types/messages";
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

/** Content being streamed (for display) */
export const streamingContent = computed(() => {
  for (const run of activeRuns.value.values()) {
    if (run.status === "streaming" && run.content) {
      return run.content;
    }
  }
  return "";
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
  const newRuns = new Map(activeRuns.value);
  newRuns.set(runId, {
    runId,
    sessionKey,
    startedAt: Date.now(),
    status: "pending",
    content: "",
  });
  activeRuns.value = newRuns;
}

/**
 * Update a chat run with streaming content
 */
export function updateRunContent(runId: string, content: string): void {
  const run = activeRuns.value.get(runId);
  if (!run) return;

  const newRuns = new Map(activeRuns.value);
  newRuns.set(runId, {
    ...run,
    status: "streaming",
    content,
  });
  activeRuns.value = newRuns;
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
  }, 1000);
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
