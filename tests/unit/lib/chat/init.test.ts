import { beforeEach, describe, expect, mock, test } from "bun:test";
import { signal } from "@preact/signals";

const calls = {
  clearActiveRuns: 0,
  clearMessages: 0,
  unsubscribeFromChatEvents: 0,
};

(globalThis as { __APP_VERSION__?: string }).__APP_VERSION__ = "test";

const sessions = signal([]);
const constants = await import("../../../../src/lib/constants");
const debouncedSignal = await import("../../../../src/lib/debounced-signal");
const messageDetection = await import("../../../../src/lib/message-detection");
const storage = await import("../../../../src/lib/storage");

mock.module("@/lib/constants", () => constants);
mock.module("@/lib/debounced-signal", () => debouncedSignal);
mock.module("@/lib/message-detection", () => messageDetection);
mock.module("@/lib/storage", () => storage);
mock.module("@/signals/sessions", () => ({
  cleanupSessionEventSubscription: () => undefined,
  clearSessions: () => undefined,
  isForActiveSession: () => true,
  sessions,
}));

const chat = await import("../../../../src/signals/chat");

mock.module("@/signals/chat", () => ({
  ...chat,
  clearActiveRuns: () => {
    calls.clearActiveRuns++;
    chat.clearActiveRuns();
  },
  clearMessages: () => {
    calls.clearMessages++;
    chat.clearMessages();
  },
}));

mock.module("../../../../src/lib/chat/history", () => ({
  loadHistory: () => Promise.resolve(),
}));

mock.module("../../../../src/lib/chat/events", () => ({
  subscribeToChatEvents: () => undefined,
  unsubscribeFromChatEvents: () => {
    calls.unsubscribeFromChatEvents++;
  },
}));

const { cleanupChat } = await import("../../../../src/lib/chat/init");

describe("chat initialization cleanup", () => {
  beforeEach(() => {
    calls.clearActiveRuns = 0;
    calls.clearMessages = 0;
    calls.unsubscribeFromChatEvents = 0;
  });

  test("clears subscriptions, messages, and active runs", () => {
    cleanupChat();

    expect(calls).toEqual({
      clearActiveRuns: 1,
      clearMessages: 1,
      unsubscribeFromChatEvents: 1,
    });
  });
});
