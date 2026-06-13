import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { signal } from "@preact/signals";
import { installFakeTimers, type FakeTimers } from "../../helpers/timers";
import { installStorageMocks } from "../../helpers/storage";
import type { Message } from "../../../src/types/messages";

(globalThis as { __APP_VERSION__?: string }).__APP_VERSION__ = "test";

let activeSessionMatches = true;
const sessions = signal<Array<{ key: string; label?: string }>>([]);
let timers: FakeTimers;
let restoreStorage: (() => void) | undefined;

const constants = await import("../../../src/lib/constants");
const debouncedSignal = await import("../../../src/lib/debounced-signal");
const messageDetection = await import("../../../src/lib/message-detection");
const storage = await import("../../../src/lib/storage");

mock.module("@/lib/constants", () => constants);
mock.module("@/lib/debounced-signal", () => debouncedSignal);
mock.module("@/lib/message-detection", () => messageDetection);
mock.module("@/lib/storage", () => storage);
mock.module("@/signals/sessions", () => ({
  cleanupSessionEventSubscription: () => undefined,
  clearSessions: () => undefined,
  isForActiveSession: () => activeSessionMatches,
  sessions,
  updateSession: () => undefined,
}));

const chat = await import("../../../src/signals/chat");

function message(overrides: Partial<Message>): Message {
  return {
    id: "msg-1",
    role: "user",
    content: "",
    timestamp: 1000,
    isStreaming: false,
    ...overrides,
  };
}

beforeEach(() => {
  restoreStorage = installStorageMocks();
  timers = installFakeTimers(1_700_000_000_000);
  activeSessionMatches = true;
  sessions.value = [];
  chat.messages.value = [];
  chat.messageQueue.value = [];
  chat.activeRuns.value = new Map();
  chat.searchQuery.value = "";
  chat.dateRangeStart.value = null;
  chat.dateRangeEnd.value = null;
  chat.chatDrafts.value = new Map();
  chat.historyError.value = null;
  chat.showCompletedCompaction.value = false;
  chat.lastCompactionSummary.value = undefined;
  chat.compactionInsertIndex.value = -1;
});

afterEach(() => {
  timers.uninstall();
  restoreStorage?.();
});

describe("chat signals", () => {
  test("addMessage deduplicates by id and merges new fields", () => {
    chat.addMessage(message({ id: "same", content: "draft", status: "sending" }));
    chat.addMessage(message({ id: "same", content: "sent", status: "sent" }));

    expect(chat.messages.value).toEqual([
      expect.objectContaining({ id: "same", content: "sent", status: "sent" }),
    ]);
  });

  test("completeRun only adds final messages for the active session and cleans up later", () => {
    chat.startRun("run-1", "session-1");
    chat.completeRun("run-1", message({ id: "assistant-1", role: "assistant", content: "done" }));

    expect(chat.messages.value.map((msg) => msg.id)).toEqual(["assistant-1"]);
    expect(chat.activeRuns.value.get("run-1")).toMatchObject({
      content: "done",
      status: "complete",
    });

    timers.advanceBy(100);
    expect(chat.activeRuns.value.has("run-1")).toBe(false);

    activeSessionMatches = false;
    chat.startRun("run-2", "other-session");
    chat.completeRun("run-2", message({ id: "assistant-2", role: "assistant", content: "hidden" }));
    expect(chat.messages.value.map((msg) => msg.id)).toEqual(["assistant-1"]);
  });

  test("error and abort cleanup timers use their configured delays", () => {
    chat.startRun("error-run", "session-1");
    chat.errorRun("error-run", "failed");
    expect(chat.activeRuns.value.get("error-run")).toMatchObject({
      error: "failed",
      status: "error",
    });
    timers.advanceBy(4_999);
    expect(chat.activeRuns.value.has("error-run")).toBe(true);
    timers.advanceBy(1);
    expect(chat.activeRuns.value.has("error-run")).toBe(false);

    chat.startRun("abort-run", "session-1");
    chat.abortRun("abort-run");
    timers.advanceBy(999);
    expect(chat.activeRuns.value.has("abort-run")).toBe(true);
    timers.advanceBy(1);
    expect(chat.activeRuns.value.has("abort-run")).toBe(false);
  });

  test("filters messages by debounced search and inclusive date range", () => {
    chat.messages.value = [
      message({ id: "old", content: "alpha", timestamp: Date.UTC(2026, 0, 1, 12) }),
      message({ id: "match", content: "needle", timestamp: Date.UTC(2026, 0, 2, 12) }),
      message({ id: "late", content: "needle", timestamp: Date.UTC(2026, 0, 3, 12) }),
    ];
    chat.dateRangeStart.value = new Date(Date.UTC(2026, 0, 2));
    chat.dateRangeEnd.value = new Date(Date.UTC(2026, 0, 2));
    chat.searchQuery.value = "needle";
    timers.advanceBy(300);

    expect(chat.filteredMessages.value.map((msg) => msg.id)).toEqual(["match"]);
    expect(chat.searchMatchCount.value).toBe(1);

    chat.clearDateFilter();
    expect(chat.hasDateFilter.value).toBe(false);
  });

  test("queue and draft helpers edit, remove, set, and clear state", () => {
    chat.queueMessage(message({ id: "queued", content: "old", status: "queued" }));
    expect(chat.hasQueuedMessages.value).toBe(true);

    chat.updateQueuedMessage("queued", "new", [{ url: "data:image/png;base64,a", alt: "a.png" }]);
    expect(chat.messageQueue.value[0]).toMatchObject({
      content: "new",
      images: [{ url: "data:image/png;base64,a", alt: "a.png" }],
    });

    chat.updateQueuedMessage("queued", "content only");
    expect(chat.messageQueue.value[0]).toMatchObject({
      content: "content only",
      images: [{ url: "data:image/png;base64,a", alt: "a.png" }],
    });

    chat.updateQueuedMessage("queued", "remove image", [], []);
    expect(chat.messageQueue.value[0]).toMatchObject({
      content: "remove image",
      images: [],
      pendingAttachments: [],
    });

    chat.dequeueMessage("queued");
    expect(chat.hasQueuedMessages.value).toBe(false);

    chat.setDraft("session-1", "hello");
    expect(chat.getDraft("session-1")).toBe("hello");
    chat.clearDraft("session-1");
    expect(chat.getDraft("session-1")).toBe("");
  });
});
