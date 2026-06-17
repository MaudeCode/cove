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

  test("reconcileMessagesFromHistory merges local run activity into matching history messages", () => {
    chat.messages.value = [
      message({
        id: "assistant_run-final",
        role: "assistant",
        content: "Final answer",
        timestamp: 2_200,
        commentaryItems: [{ id: "commentary-1", text: "Checked files", seq: 1 }],
        runStartedAt: 1_000,
        runCompletedAt: 2_200,
        toolCalls: [{ id: "tool-1", name: "read", status: "complete", result: "ok", seq: 2 }],
      }),
    ];

    const reconciled = chat.reconcileMessagesFromHistory(
      "session-1",
      [
        message({
          id: "hist_assistant",
          role: "assistant",
          content: "Final answer",
          timestamp: 2_000,
          toolCalls: [{ id: "tool-1", name: "read", status: "complete", result: "ok" }],
        }),
      ],
      1_500,
    );

    expect(reconciled).toHaveLength(1);
    expect(reconciled[0]).toMatchObject({
      id: "hist_assistant",
      content: "Final answer",
      commentaryItems: [{ id: "commentary-1", text: "Checked files", seq: 1 }],
      runStartedAt: 1_000,
      runCompletedAt: 2_200,
      toolCalls: [expect.objectContaining({ id: "tool-1", seq: 2 })],
    });
  });

  test("reconcileMessagesFromHistory merges repeated assistant run activity into the closest history row", () => {
    chat.messages.value = [
      message({
        id: "assistant_run-later",
        role: "assistant",
        content: "Done",
        timestamp: 2_200,
        commentaryItems: [{ id: "commentary-later", text: "Checked later files", seq: 3 }],
        runStartedAt: 2_000,
        runCompletedAt: 2_200,
        toolCalls: [{ id: "tool-later", name: "read", status: "complete", seq: 4 }],
      }),
    ];

    const reconciled = chat.reconcileMessagesFromHistory(
      "session-1",
      [
        message({
          id: "hist_assistant_earlier",
          role: "assistant",
          content: "Done",
          timestamp: 2_000,
        }),
        message({
          id: "hist_assistant_later",
          role: "assistant",
          content: "Done",
          timestamp: 2_190,
        }),
      ],
      1_500,
    );

    expect(reconciled.map((msg) => msg.id)).toEqual([
      "hist_assistant_earlier",
      "hist_assistant_later",
    ]);
    expect(reconciled[0]?.commentaryItems).toBeUndefined();
    expect(reconciled[0]?.toolCalls).toBeUndefined();
    expect(reconciled[1]?.commentaryItems).toEqual([
      { id: "commentary-later", text: "Checked later files", seq: 3 },
    ]);
    expect(reconciled[1]?.toolCalls?.[0]?.id).toBe("tool-later");
    expect(reconciled[1]?.toolCalls?.[0]?.seq).toBe(4);
  });

  test("reconcileMessagesFromHistory preserves unmatched commentary-only run activity", () => {
    chat.messages.value = [
      message({
        id: "assistant_run-commentary",
        role: "assistant",
        content: "",
        timestamp: 2_200,
        commentaryItems: [{ id: "commentary-1", text: "Checked files", seq: 1 }],
        runStartedAt: 1_000,
        runCompletedAt: 2_200,
        toolCalls: [{ id: "tool-1", name: "read", status: "complete", result: "ok", seq: 2 }],
      }),
    ];

    const reconciled = chat.reconcileMessagesFromHistory(
      "session-1",
      [
        message({
          id: "hist_user",
          content: "Run a check",
          timestamp: 2_000,
        }),
      ],
      2_500,
    );

    expect(reconciled.map((msg) => msg.id)).toEqual(["hist_user", "assistant_run-commentary"]);
    expect(reconciled[1]).toMatchObject({
      id: "assistant_run-commentary",
      content: "",
      commentaryItems: [{ id: "commentary-1", text: "Checked files", seq: 1 }],
      runStartedAt: 1_000,
      runCompletedAt: 2_200,
    });
    expect(reconciled[1]?.toolCalls?.[0]?.id).toBe("tool-1");
    expect(reconciled[1]?.toolCalls?.[0]?.seq).toBe(2);
  });

  test("reconcileMessagesFromHistory preserves newer local final content when only tool ids match", () => {
    chat.messages.value = [
      message({
        id: "assistant_run-final",
        role: "assistant",
        content: "New final answer",
        timestamp: 2_200,
        commentaryItems: [{ id: "commentary-1", text: "Checked files", seq: 1 }],
        runStartedAt: 1_000,
        runCompletedAt: 2_200,
        toolCalls: [{ id: "tool-1", name: "read", status: "complete", result: "ok", seq: 2 }],
      }),
    ];

    const reconciled = chat.reconcileMessagesFromHistory(
      "session-1",
      [
        message({
          id: "hist_assistant",
          role: "assistant",
          content: "Stale final answer",
          timestamp: 2_000,
          toolCalls: [{ id: "tool-1", name: "read", status: "complete", result: "ok" }],
        }),
      ],
      1_500,
    );

    expect(reconciled.map((msg) => msg.id)).toEqual(["hist_assistant", "assistant_run-final"]);
    expect(reconciled[0]).toMatchObject({
      id: "hist_assistant",
      content: "Stale final answer",
      commentaryItems: [{ id: "commentary-1", text: "Checked files", seq: 1 }],
      runStartedAt: 1_000,
      runCompletedAt: 2_200,
      toolCalls: [expect.objectContaining({ id: "tool-1", seq: 2 })],
    });
    expect(reconciled[1]).toMatchObject({
      id: "assistant_run-final",
      content: "New final answer",
    });
  });

  test("reconcileMessagesFromHistory does not duplicate newer local final messages already in history", () => {
    chat.messages.value = [
      message({
        id: "assistant_run-final",
        role: "assistant",
        content: "Final answer",
        timestamp: 2_200,
        commentaryItems: [{ id: "commentary-1", text: "Checked files", seq: 1 }],
      }),
    ];

    const reconciled = chat.reconcileMessagesFromHistory(
      "session-1",
      [
        message({
          id: "hist_assistant",
          role: "assistant",
          content: "Final answer",
          timestamp: 2_000,
        }),
      ],
      1_500,
    );

    expect(reconciled.map((msg) => msg.id)).toEqual(["hist_assistant"]);
    expect(reconciled[0]?.commentaryItems).toEqual([
      { id: "commentary-1", text: "Checked files", seq: 1 },
    ]);
  });

  test("reconcileMessagesFromHistory deduplicates equivalent commentary while preserving the first sequence", () => {
    chat.messages.value = [
      message({
        id: "assistant_run-final",
        role: "assistant",
        content: "Final answer",
        timestamp: 2_200,
        commentaryItems: [{ id: "commentary-local", text: "Checked files", seq: 1 }],
      }),
    ];

    const reconciled = chat.reconcileMessagesFromHistory(
      "session-1",
      [
        message({
          id: "hist_assistant",
          role: "assistant",
          content: "Final answer",
          timestamp: 2_000,
          commentaryItems: [{ id: "commentary-history", text: "Checked files", seq: 99 }],
        }),
      ],
      1_500,
    );

    expect(reconciled[0]?.commentaryItems).toEqual([
      { id: "commentary-history", text: "Checked files", seq: 99 },
    ]);
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

  test("reconcileMessagesFromHistory preserves repeated sent prompts newer than the request", () => {
    chat.messages.value = [
      message({
        id: "user_repeat_newer",
        content: "OK",
        status: "sent",
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
      1_990,
    );

    expect(chat.messages.value.map((msg) => msg.id)).toEqual(["hist_repeat", "user_repeat_newer"]);
  });

  test("reconcileMessagesFromHistory does not duplicate repeated sent prompts already caught by history", () => {
    chat.messages.value = [
      message({
        id: "user_repeat_newer",
        content: "OK",
        status: "sent",
        sessionKey: "session-1",
        timestamp: 2_000,
      }),
    ];

    chat.reconcileMessagesFromHistory(
      "session-1",
      [
        message({
          id: "hist_repeat_older",
          content: "OK",
          timestamp: 1_950,
        }),
        message({
          id: "hist_repeat_newer",
          content: "OK",
          timestamp: 2_005,
        }),
      ],
      1_990,
    );

    expect(chat.messages.value.map((msg) => msg.id)).toEqual([
      "hist_repeat_older",
      "hist_repeat_newer",
    ]);
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

  test("completeRun without a message preserves no-message semantics even with commentary", () => {
    chat.startRun("run-commentary", "session-1");
    chat.updateRunCommentaryItem("run-commentary", {
      id: "commentary-1",
      text: "Inspecting files",
      seq: 1,
    });

    chat.completeRun("run-commentary");

    expect(chat.messages.value).toEqual([]);
    expect(chat.activeRuns.value.get("run-commentary")).toMatchObject({
      content: "",
      commentaryItems: [{ id: "commentary-1", text: "Inspecting files", seq: 1 }],
      status: "complete",
    });
  });

  test("completeRun does not content-match ambiguous recent history rows", () => {
    chat.messages.value = [
      message({ id: "hist-1", role: "assistant", content: "Done with more detail" }),
      message({ id: "hist-2", role: "assistant", content: "Done elsewhere" }),
    ];

    chat.startRun("run-content", "session-1");
    chat.completeRun("run-content");
    chat.completeRun(
      "run-content",
      message({ id: "assistant_run-content", role: "assistant", content: "Done" }),
    );

    expect(chat.messages.value.map((msg) => [msg.id, msg.content])).toEqual([
      ["hist-1", "Done with more detail"],
      ["hist-2", "Done elsewhere"],
      ["assistant_run-content", "Done"],
    ]);
  });

  test("completeRun appends known-session finals instead of using content-only recent matches", () => {
    const now = Date.now();
    chat.messages.value = [
      message({
        id: "hist-setup",
        role: "assistant",
        content: "Done with setup",
        timestamp: now,
      }),
    ];

    chat.startRun("run-content", "session-1");
    chat.completeRun(
      "run-content",
      message({
        id: "assistant_run-content",
        role: "assistant",
        content: "Done",
        timestamp: now + 1,
        toolCalls: [{ id: "tool-new", name: "setup", status: "complete", result: "ok" }],
      }),
    );

    expect(chat.messages.value.map((msg) => [msg.id, msg.content])).toEqual([
      ["hist-setup", "Done with setup"],
      ["assistant_run-content", "Done"],
    ]);
    expect(chat.messages.value[1]?.toolCalls).toEqual([
      expect.objectContaining({ id: "tool-new" }),
    ]);
  });

  test("completeRun reconciles repeated finals with matching tool-call ids", () => {
    const now = Date.now();
    chat.messages.value = [
      message({
        id: "hist-final",
        role: "assistant",
        content: "Done with setup details",
        timestamp: now,
        toolCalls: [{ id: "tool-1", name: "setup", status: "running" }],
      }),
    ];

    chat.startRun("run-repeat", "session-1");
    chat.completeRun(
      "run-repeat",
      message({
        id: "assistant_run-repeat",
        role: "assistant",
        content: "Done",
        timestamp: now + 1,
        toolCalls: [{ id: "tool-1", name: "setup", status: "complete", result: "ok" }],
      }),
    );

    expect(chat.messages.value.map((msg) => [msg.id, msg.content])).toEqual([
      ["hist-final", "Done with setup details"],
    ]);
    expect(chat.messages.value[0]?.toolCalls).toEqual([
      expect.objectContaining({ id: "tool-1", status: "complete", result: "ok" }),
    ]);
  });

  test("completeRun reconciles text-only finals after history replaces the local run message id", () => {
    const now = Date.now();

    chat.startRun("run-text", "session-1");
    chat.completeRun(
      "run-text",
      message({
        id: "assistant_run-text",
        role: "assistant",
        content: "Done",
        timestamp: now,
      }),
    );

    chat.reconcileMessagesFromHistory(
      "session-1",
      [
        message({
          id: "hist_0_1700000000000",
          role: "assistant",
          content: "Done",
          timestamp: now,
        }),
      ],
      now - 500,
    );

    expect(chat.messages.value).toEqual([
      expect.objectContaining({
        id: "hist_0_1700000000000",
        content: "Done",
        runId: "run-text",
      }),
    ]);

    chat.completeRun(
      "run-text",
      message({
        id: "assistant_run-text",
        role: "assistant",
        content: "Done",
        timestamp: now + 1,
      }),
    );

    expect(chat.messages.value).toHaveLength(1);
    expect(chat.messages.value[0]).toMatchObject({
      id: "hist_0_1700000000000",
      content: "Done",
      runId: "run-text",
    });
  });

  test("completeRunWithCommentaryOnlyMessage explicitly creates a commentary-only transcript message", () => {
    chat.startRun("run-commentary", "session-1");
    chat.updateRunCommentaryItem("run-commentary", {
      id: "commentary-1",
      text: "Inspecting files",
      seq: 1,
    });

    chat.completeRunWithCommentaryOnlyMessage("run-commentary");

    expect(chat.messages.value).toEqual([
      expect.objectContaining({
        id: "assistant_run-commentary",
        role: "assistant",
        content: "",
        commentaryItems: [{ id: "commentary-1", text: "Inspecting files", seq: 1 }],
      }),
    ]);
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

  test("adoptRunId merges optimistic and gateway commentary", () => {
    chat.startRun("optimistic", "session-1");
    chat.updateRunCommentaryItem("optimistic", {
      id: "commentary-optimistic",
      text: "Queued locally",
      seq: 1,
    });
    chat.startRun("gateway-run", "session-1");
    chat.updateRunCommentaryItem("gateway-run", {
      id: "commentary-gateway",
      text: "Streaming from gateway",
      seq: 2,
    });

    chat.adoptRunId("optimistic", "gateway-run");

    expect(chat.activeRuns.value.get("gateway-run")?.commentaryItems).toEqual([
      { id: "commentary-optimistic", text: "Queued locally", seq: 1 },
      { id: "commentary-gateway", text: "Streaming from gateway", seq: 2 },
    ]);
  });

  test("same-id commentary updates preserve the original sequence", () => {
    chat.startRun("run-commentary", "session-1");
    chat.updateRunCommentaryItem("run-commentary", {
      id: "commentary-1",
      text: "Inspecting files",
      seq: 1,
    });
    chat.updateRunCommentaryItem("run-commentary", {
      id: "commentary-1",
      text: "Still inspecting",
      seq: 5,
    });

    expect(chat.activeRuns.value.get("run-commentary")?.commentaryItems).toEqual([
      { id: "commentary-1", text: "Still inspecting", seq: 1 },
    ]);
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
    chat.startRun("run-active", "session-1");
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

    chat.completeRun("run-active", message({ id: "assistant-final", role: "assistant" }));

    expect(chat.messageQueue.value).toEqual([]);
  });

  test("stale persisted steered queue items are pruned during history reconciliation", () => {
    chat.queueMessage(
      message({
        id: "stale-steer",
        content: "this run finished while closed",
        pendingRunId: "run-gone",
        queueKind: "steered",
        sessionKey: "session-1",
        status: "sent",
      }),
    );
    chat.queueMessage(
      message({
        id: "other-session-steer",
        content: "leave other sessions alone",
        pendingRunId: "run-other",
        queueKind: "steered",
        sessionKey: "session-2",
        status: "sent",
      }),
    );

    chat.reconcileMessagesFromHistory(
      "session-1",
      [message({ id: "hist-1", role: "assistant", content: "done", timestamp: 900 })],
      1_000,
    );

    expect(chat.messageQueue.value).toEqual([
      expect.objectContaining({
        id: "other-session-steer",
        pendingRunId: "run-other",
        queueKind: "steered",
      }),
    ]);
  });
});
