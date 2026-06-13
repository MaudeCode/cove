import { beforeEach, describe, expect, mock, test } from "bun:test";

const calls = {
  clearActiveRuns: 0,
  clearMessages: 0,
  unsubscribeFromChatEvents: 0,
};

mock.module("@/signals/chat", () => ({
  clearActiveRuns: () => {
    calls.clearActiveRuns++;
  },
  clearMessages: () => {
    calls.clearMessages++;
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
