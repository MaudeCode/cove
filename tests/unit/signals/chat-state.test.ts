import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { signal } from "@preact/signals";
import { createSessionSignalsMock } from "../../helpers/module-mocks";
import { installFakeTimers, type FakeTimers } from "../../helpers/timers";
import { installStorageMocks } from "../../helpers/storage";
import type { AttachmentPayload } from "../../../src/types/attachments";
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
mock.module("@/signals/sessions", () =>
  createSessionSignalsMock({ isForActiveSession: () => activeSessionMatches, sessions }),
);

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

function attachment(type: AttachmentPayload["type"], fileName: string): AttachmentPayload {
  const mimeType = type === "image" ? "image/png" : "text/plain";
  return {
    type,
    mimeType,
    fileName,
    content: `data:${mimeType};base64,${fileName}`,
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

  test("reconcileMessagesFromHistory preserves unresolved same-session tail messages", () => {
    chat.messages.value = [
      message({
        id: "user_duplicate",
        content: "already stored",
        status: "sent",
        sessionKey: "session-1",
        timestamp: 1_050,
      }),
      message({
        id: "user_tail",
        content: "still sending",
        status: "sending",
        sessionKey: "session-1",
        timestamp: 2_000,
      }),
      message({
        id: "user_other",
        content: "other session",
        status: "sending",
        sessionKey: "other-session",
        timestamp: 2_100,
      }),
      message({
        id: "assistant_local-run",
        role: "assistant",
        content: "local final",
        timestamp: 2_200,
        toolCalls: [{ id: "tool-local", name: "read", status: "complete", result: "ok" }],
      }),
    ];
    chat.startRun("streaming-run", "session-1");
    chat.updateRunContent("streaming-run", "partial", [
      { id: "tool-1", name: "read", status: "running" },
    ]);

    const reconciled = chat.reconcileMessagesFromHistory(
      "session-1",
      [
        message({
          id: "hist_user",
          content: "already stored",
          timestamp: 1_000,
        }),
        message({
          id: "hist_assistant",
          role: "assistant",
          content: "loaded",
          timestamp: 1_100,
        }),
      ],
      1_500,
    );

    expect(reconciled.map((msg) => msg.id)).toEqual([
      "hist_user",
      "hist_assistant",
      "user_tail",
      "assistant_local-run",
    ]);
    expect(chat.messages.value.map((msg) => msg.id)).toEqual([
      "hist_user",
      "hist_assistant",
      "user_tail",
      "assistant_local-run",
    ]);
    expect(chat.messages.value.at(-1)?.toolCalls).toEqual([
      expect.objectContaining({ id: "tool-local", result: "ok" }),
    ]);
    expect(chat.activeRuns.value.get("streaming-run")).toMatchObject({
      content: "partial",
      status: "streaming",
      toolCalls: [expect.objectContaining({ id: "tool-1" })],
    });
  });

  test("reconcileMessagesFromHistory preserves repeated unresolved prompts", () => {
    chat.messages.value = [
      message({
        id: "user_repeat",
        content: "OK",
        status: "sending",
        sessionKey: "session-1",
        timestamp: 2_000,
      }),
    ];

    chat.reconcileMessagesFromHistory(
      "session-1",
      [
        message({
          id: "hist_repeat",
          content: "OK",
          timestamp: 1_950,
        }),
      ],
      2_500,
    );

    expect(chat.messages.value.map((msg) => msg.id)).toEqual(["hist_repeat", "user_repeat"]);
  });

  test("reconcileMessagesFromHistory drops stale completed messages after a reset", () => {
    chat.messages.value = [
      message({
        id: "user_old",
        content: "stale sent prompt",
        status: "sent",
        sessionKey: "session-1",
        timestamp: 1_000,
      }),
      message({
        id: "assistant_old",
        role: "assistant",
        content: "stale final reply",
        sessionKey: "session-1",
        timestamp: 1_100,
      }),
      message({
        id: "side_old",
        role: "assistant",
        content: "stale side reply",
        sessionKey: "session-1",
        timestamp: 1_200,
      }),
      message({
        id: "user_pending",
        content: "pending prompt",
        status: "sending",
        sessionKey: "session-1",
        timestamp: 1_300,
      }),
      message({
        id: "user_new",
        content: "new prompt",
        status: "sent",
        sessionKey: "session-1",
        timestamp: 2_100,
      }),
      message({
        id: "assistant_new",
        role: "assistant",
        content: "new final reply",
        sessionKey: "session-1",
        timestamp: 2_200,
      }),
    ];

    chat.reconcileMessagesFromHistory("session-1", [], 2_000);

    expect(chat.messages.value.map((msg) => msg.id)).toEqual([
      "user_pending",
      "user_new",
      "assistant_new",
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

  test("adoptRunId rekeys optimistic runs and preserves gateway stream state", () => {
    chat.startRun("optimistic", "session-1");
    chat.startRun("gateway-run", "session-1");
    chat.updateRunContent("gateway-run", "streamed", [
      {
        id: "tool-1",
        name: "read",
        status: "running",
        startedAt: 1000,
      },
    ]);

    chat.adoptRunId("optimistic", "gateway-run");

    expect(chat.activeRuns.value.has("optimistic")).toBe(false);
    expect(chat.activeRuns.value.get("gateway-run")).toMatchObject({
      content: "streamed",
      runId: "gateway-run",
      sessionKey: "session-1",
      status: "streaming",
      toolCalls: [expect.objectContaining({ id: "tool-1" })],
    });
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
    const fileAttachment = attachment("file", "notes.txt");
    chat.queueMessage(
      message({
        id: "queued",
        content: "old",
        pendingAttachments: [attachment("image", "old.png"), fileAttachment],
        status: "queued",
      }),
    );
    expect(chat.hasQueuedMessages.value).toBe(true);

    chat.updateQueuedMessage("queued", "new", [{ url: "data:image/png;base64,a", alt: "a.png" }]);
    expect(chat.messageQueue.value[0]).toMatchObject({
      content: "new",
      images: [{ url: "data:image/png;base64,a", alt: "a.png" }],
      pendingAttachments: [
        fileAttachment,
        {
          content: "data:image/png;base64,a",
          fileName: "a.png",
          mimeType: "image/png",
          type: "image",
        },
      ],
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

  test("pending steered queue items survive history reconciliation and clear when their run ends", () => {
    chat.queueMessage(
      message({
        id: "steer-1",
        content: "tighten the plan",
        pendingRunId: "run-active",
        queueKind: "steered",
        sessionKey: "session-1",
        status: "sent",
      }),
    );

    chat.reconcileMessagesFromHistory(
      "session-1",
      [message({ id: "hist-1", role: "assistant", content: "still working", timestamp: 900 })],
      1_000,
    );

    expect(chat.messageQueue.value).toEqual([
      expect.objectContaining({
        id: "steer-1",
        pendingRunId: "run-active",
        queueKind: "steered",
      }),
    ]);

    chat.startRun("run-active", "session-1");
    chat.completeRun("run-active", message({ id: "assistant-final", role: "assistant" }));

    expect(chat.messageQueue.value).toEqual([]);
  });
});
