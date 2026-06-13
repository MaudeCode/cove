import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { signal } from "@preact/signals";
import { installI18nMock } from "../../../helpers/i18n";
import { installFakeTimers, type FakeTimers } from "../../../helpers/timers";
import { installStorageMocks } from "../../../helpers/storage";
import type { AgentEvent, ChatEvent } from "../../../../src/types/chat";

(globalThis as { __APP_VERSION__?: string }).__APP_VERSION__ = "test";

type NamedHandler = (payload: unknown) => void;
type GatewayEventHandler = (event: { event: string; payload: unknown; seq?: number }) => void;
type GatewayHarness = {
  send?: (method: string, params?: unknown) => unknown;
};

let activeSessionMatches = true;
const namedHandlers = new Map<string, NamedHandler>();
const gatewayHandlers: GatewayEventHandler[] = [];
const isConnected = signal(true);
const mainSessionKey = signal<string | null>("main");
const sessions = signal([]);
const gatewayHarness = ((
  globalThis as { __coveGatewayHarness?: GatewayHarness }
).__coveGatewayHarness ??= {});

const constants = await import("../../../../src/lib/constants");
const debouncedSignal = await import("../../../../src/lib/debounced-signal");
const messageDetection = await import("../../../../src/lib/message-detection");
const storage = await import("../../../../src/lib/storage");
const streaming = await import("../../../../src/lib/streaming");
const toolUtils = await import("../../../../src/lib/tool-utils");
const typeGuards = await import("../../../../src/lib/type-guards");
const utils = await import("../../../../src/lib/utils");

mock.module("@/lib/gateway", () => ({
  disconnect: () => undefined,
  isConnected,
  mainSessionKey,
  on: (event: string, handler: NamedHandler) => {
    namedHandlers.set(event, handler);
    return () => namedHandlers.delete(event);
  },
  send: async (method: string, params?: unknown) =>
    gatewayHarness.send?.(method, params) ?? { messages: [] },
  subscribe: (handler: GatewayEventHandler) => {
    gatewayHandlers.push(handler);
    return () => {
      const index = gatewayHandlers.indexOf(handler);
      if (index >= 0) gatewayHandlers.splice(index, 1);
    };
  },
}));
mock.module("@/lib/logger", () => ({
  log: {
    chat: {
      debug: () => undefined,
      error: () => undefined,
      info: () => undefined,
      warn: () => undefined,
    },
  },
}));
mock.module("@/lib/constants", () => constants);
mock.module("@/lib/debounced-signal", () => debouncedSignal);
mock.module("@/lib/message-detection", () => messageDetection);
mock.module("@/lib/storage", () => storage);
mock.module("@/lib/streaming", () => streaming);
mock.module("@/lib/tool-utils", () => toolUtils);
mock.module("@/lib/type-guards", () => typeGuards);
mock.module("@/lib/utils", () => utils);
installI18nMock({ t: (key: string) => key });

const sessionUtils = await import("../../../../src/lib/session-utils");
const typesChat = await import("../../../../src/types/chat");

mock.module("@/lib/session-utils", () => sessionUtils);
mock.module("@/types/chat", () => typesChat);
mock.module("@/signals/sessions", () => ({
  cleanupSessionEventSubscription: () => undefined,
  clearSessions: () => undefined,
  isForActiveSession: () => activeSessionMatches,
  sessions,
  updateSession: () => undefined,
}));

const chat = await import("../../../../src/signals/chat");
mock.module("@/signals/chat", () => chat);
const { subscribeToChatEvents, unsubscribeFromChatEvents } =
  await import("../../../../src/lib/chat/events");

function emitChat(event: Partial<ChatEvent> & Pick<ChatEvent, "runId" | "state">): void {
  namedHandlers.get("chat")?.({
    sessionKey: "session-1",
    seq: 1,
    ...event,
  });
}

function emitAgent(event: Partial<AgentEvent> & Pick<AgentEvent, "runId" | "stream">): void {
  namedHandlers.get("agent")?.({
    sessionKey: "session-1",
    seq: 1,
    ts: Date.now(),
    ...event,
  });
}

function emitGatewayEvent(event: string, payload: unknown, seq?: number): void {
  for (const handler of gatewayHandlers) {
    handler({ event, payload, seq });
  }
}

describe("chat event handling", () => {
  let timers: FakeTimers;
  let restoreStorage: (() => void) | undefined;

  beforeEach(() => {
    restoreStorage = installStorageMocks();
    timers = installFakeTimers(1_700_000_000_000);
    activeSessionMatches = true;
    namedHandlers.clear();
    gatewayHandlers.length = 0;
    unsubscribeFromChatEvents();
    chat.messages.value = [];
    chat.messageQueue.value = [];
    chat.activeRuns.value = new Map();
    chat.isCompacting.value = false;
    chat.lastCompactionSummary.value = undefined;
    chat.showCompletedCompaction.value = false;
    chat.compactionInsertIndex.value = -1;
    subscribeToChatEvents();
  });

  afterEach(() => {
    unsubscribeFromChatEvents();
    timers.uninstall();
    restoreStorage?.();
  });

  test("filters events outside the active session and ignores stale assistant text", () => {
    activeSessionMatches = false;
    emitAgent({ runId: "ignored", stream: "assistant", data: { text: "hidden" } });
    expect(chat.activeRuns.value.has("ignored")).toBe(false);

    activeSessionMatches = true;
    emitAgent({ runId: "run-1", stream: "assistant", data: { text: "hello" } });
    emitAgent({ runId: "run-1", stream: "assistant", data: { text: "he" } });

    expect(chat.activeRuns.value.get("run-1")).toMatchObject({
      content: "hello",
      status: "streaming",
    });
  });

  test("ignores stale chat delta fallback after assistant delta resumes", () => {
    emitChat({ runId: "run-delta", state: "delta", deltaText: "Hel" });
    emitAgent({ runId: "run-delta", stream: "assistant", data: { delta: "lo" } });
    emitChat({ runId: "run-delta", state: "delta", deltaText: "lo" });

    expect(chat.activeRuns.value.get("run-delta")).toMatchObject({
      content: "Hello",
    });
  });

  test("merges tool start, update, and error result events into one run tool call", () => {
    emitAgent({ runId: "run-tool", stream: "assistant", data: { text: "before" } });
    emitAgent({
      runId: "run-tool",
      stream: "tool",
      data: {
        phase: "start",
        toolCallId: "tool-1",
        name: "read",
        args: { path: "README.md" },
      },
    });
    timers.advanceBy(0);

    emitAgent({
      runId: "run-tool",
      stream: "tool",
      data: {
        phase: "update",
        toolCallId: "tool-1",
        name: "read",
        partialResult: [{ type: "text", text: "partial" }],
      },
    });
    emitAgent({
      runId: "run-tool",
      stream: "tool",
      data: {
        phase: "result",
        toolCallId: "tool-1",
        name: "read",
        result: { tool: "read", error: "missing" },
        isError: true,
      },
    });

    expect(chat.activeRuns.value.get("run-tool")?.toolCalls).toEqual([
      expect.objectContaining({
        id: "tool-1",
        name: "read",
        args: { path: "README.md" },
        insertedAtContentLength: "before".length,
        result: { tool: "read", error: "missing" },
        status: "error",
      }),
    ]);
  });

  test("completes heartbeat finals without adding assistant messages", () => {
    emitAgent({ runId: "heartbeat", stream: "assistant", data: { text: "heartbeat_ok" } });
    emitChat({
      runId: "heartbeat",
      state: "final",
      message: { role: "assistant", content: "heartbeat_ok", timestamp: 1000 },
    });

    expect(chat.messages.value).toEqual([]);
    expect(chat.activeRuns.value.get("heartbeat")).toMatchObject({ status: "complete" });
  });

  test("prevents compaction ghost runs and records completed compaction state", () => {
    activeSessionMatches = false;
    emitAgent({
      runId: "other-compact",
      stream: "compaction",
      data: { phase: "start" },
    });
    expect(chat.isCompacting.value).toBe(false);
    expect(chat.activeRuns.value.has("other-compact")).toBe(false);

    activeSessionMatches = true;
    emitAgent({
      runId: "compact",
      stream: "lifecycle",
      data: { phase: "start" },
    });
    expect(chat.activeRuns.value.has("compact")).toBe(true);

    chat.messages.value = [
      {
        id: "existing",
        role: "assistant",
        content: "before compaction",
        timestamp: 1000,
        isStreaming: false,
      },
    ];
    emitAgent({
      runId: "compact",
      stream: "compaction",
      data: { phase: "start" },
    });
    emitAgent({
      runId: "compact",
      stream: "compaction",
      data: { phase: "end", summary: "summarized" },
    });
    emitChat({ runId: "compact", state: "final" });

    expect(chat.activeRuns.value.has("compact")).toBe(false);
    expect(chat.messages.value).toHaveLength(1);
    expect(chat.isCompacting.value).toBe(false);
    expect(chat.showCompletedCompaction.value).toBe(true);
    expect(chat.lastCompactionSummary.value).toBe("summarized");
    expect(chat.compactionInsertIndex.value).toBe(1);
  });

  test("adds active-session side results as system messages", () => {
    emitGatewayEvent(
      "chat.side_result",
      { sessionKey: "session-1", title: "Preview", text: "side text" },
      42,
    );

    expect(chat.messages.value).toEqual([
      expect.objectContaining({
        id: "side_session-1_42",
        role: "system",
        content: "**Preview**\n\nside text",
      }),
    ]);

    activeSessionMatches = false;
    emitGatewayEvent("chat.side_result", { sessionKey: "other", text: "hidden" }, 43);
    expect(chat.messages.value).toHaveLength(1);
  });
});
