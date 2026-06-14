import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { signal } from "@preact/signals";
import { installI18nMock } from "../../../helpers/i18n";
import { createGatewayMock, createSessionSignalsMock } from "../../../helpers/module-mocks";
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
const capabilities = signal(["sessions.messages.subscribe", "sessions.messages.unsubscribe"]);
const sessions = signal([]);
const activeSessionKey = signal<string | null>(null);
const effectiveSessionKey = signal<string | null>(null);
const gatewayCalls: Array<{ method: string; params: unknown }> = [];
const gatewayHarness = ((
  globalThis as { __coveGatewayHarness?: GatewayHarness }
).__coveGatewayHarness ??= {});

const sendMock = async (method: string, params?: unknown) => {
  gatewayCalls.push({ method, params });
  return gatewayHarness.send?.(method, params) ?? { messages: [] };
};

const constants = await import("../../../../src/lib/constants");
const debouncedSignal = await import("../../../../src/lib/debounced-signal");
const messageDetection = await import("../../../../src/lib/message-detection");
const storage = await import("../../../../src/lib/storage");
const streaming = await import("../../../../src/lib/streaming");
const toolUtils = await import("../../../../src/lib/tool-utils");
const typeGuards = await import("../../../../src/lib/type-guards");
const utils = await import("../../../../src/lib/utils");

mock.module("@/lib/gateway", () => ({
  ...createGatewayMock({
    capabilities,
    isConnected,
    mainSessionKey,
    send: sendMock,
  }),
  on: (event: string, handler: NamedHandler) => {
    namedHandlers.set(event, handler);
    return () => namedHandlers.delete(event);
  },
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
  ...createSessionSignalsMock({ isForActiveSession: () => activeSessionMatches, sessions }),
  activeSessionKey,
  effectiveSessionKey,
  isForActiveSession: () => activeSessionMatches,
}));

const chat = await import("../../../../src/signals/chat");
mock.module("@/signals/chat", () => chat);
const modelSignals = await import("../../../../src/signals/models");
mock.module("@/signals/models", () => modelSignals);
const { consumeResetRun, registerResetRun } =
  await import("../../../../src/lib/chat/reset-reconciliation");
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

async function flushGatewayTasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("chat event handling", () => {
  let timers: FakeTimers;
  let restoreStorage: (() => void) | undefined;

  beforeEach(() => {
    restoreStorage = installStorageMocks();
    timers = installFakeTimers(1_700_000_000_000);
    activeSessionMatches = true;
    isConnected.value = true;
    activeSessionKey.value = null;
    effectiveSessionKey.value = null;
    capabilities.value = ["sessions.messages.subscribe", "sessions.messages.unsubscribe"];
    gatewayCalls.length = 0;
    gatewayHarness.send = undefined;
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
    consumeResetRun("reset-run");
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

  test("subscribes to the selected active-session message stream", async () => {
    unsubscribeFromChatEvents();
    effectiveSessionKey.value = "agent:main:main";

    subscribeToChatEvents();
    await Promise.resolve();

    expect(gatewayCalls).toContainEqual({
      method: "sessions.messages.subscribe",
      params: { key: "agent:main:main" },
    });
  });

  test("switches selected-session message streams when the active session changes", async () => {
    unsubscribeFromChatEvents();
    effectiveSessionKey.value = "agent:main:first";
    subscribeToChatEvents();
    await Promise.resolve();
    gatewayCalls.length = 0;

    effectiveSessionKey.value = "agent:main:second";
    await Promise.resolve();

    expect(gatewayCalls).toEqual([
      {
        method: "sessions.messages.unsubscribe",
        params: { key: "agent:main:first" },
      },
      {
        method: "sessions.messages.subscribe",
        params: { key: "agent:main:second" },
      },
    ]);
  });

  test("subscribes to the next selected-session stream when previous unsubscribe fails", async () => {
    unsubscribeFromChatEvents();
    effectiveSessionKey.value = "agent:main:first";
    subscribeToChatEvents();
    await Promise.resolve();
    gatewayCalls.length = 0;

    gatewayHarness.send = async (method: string, params?: unknown) => {
      if (method === "sessions.messages.unsubscribe") {
        throw new Error("unsubscribe timed out");
      }
      if (method === "sessions.messages.subscribe") {
        return { key: (params as { key: string }).key };
      }
      return { messages: [] };
    };

    effectiveSessionKey.value = "agent:main:second";
    await Promise.resolve();
    await Promise.resolve();

    expect(gatewayCalls).toEqual([
      {
        method: "sessions.messages.unsubscribe",
        params: { key: "agent:main:first" },
      },
      {
        method: "sessions.messages.subscribe",
        params: { key: "agent:main:second" },
      },
    ]);
  });

  test("uses returned selected-session subscription keys for switch and cleanup unsubscribe", async () => {
    unsubscribeFromChatEvents();
    gatewayHarness.send = async (method: string, params?: unknown) => {
      if (method === "sessions.messages.subscribe") {
        return { key: `canonical:${(params as { key: string }).key}` };
      }
      return { messages: [] };
    };

    effectiveSessionKey.value = "agent:main:first";
    subscribeToChatEvents();
    await flushGatewayTasks();
    gatewayCalls.length = 0;

    effectiveSessionKey.value = "agent:main:second";
    await flushGatewayTasks();

    expect(gatewayCalls[0]).toEqual({
      method: "sessions.messages.unsubscribe",
      params: { key: "canonical:agent:main:first" },
    });

    gatewayCalls.length = 0;
    unsubscribeFromChatEvents();
    await Promise.resolve();

    expect(gatewayCalls).toEqual([
      {
        method: "sessions.messages.unsubscribe",
        params: { key: "canonical:agent:main:second" },
      },
    ]);
  });

  test("does not let a stale reconnect subscribe cleanup unsubscribe the current stream", async () => {
    unsubscribeFromChatEvents();
    effectiveSessionKey.value = "agent:main:main";

    let subscribeCount = 0;
    let resolveFirstSubscribe: ((value: unknown) => void) | undefined;
    let resolveSecondSubscribe: ((value: unknown) => void) | undefined;
    gatewayHarness.send = (method: string) => {
      if (method !== "sessions.messages.subscribe") {
        return { messages: [] };
      }
      subscribeCount += 1;
      return new Promise((resolve) => {
        if (subscribeCount === 1) {
          resolveFirstSubscribe = resolve;
        } else {
          resolveSecondSubscribe = resolve;
        }
      });
    };

    subscribeToChatEvents();
    await Promise.resolve();

    isConnected.value = false;
    await Promise.resolve();
    isConnected.value = true;
    await Promise.resolve();

    resolveSecondSubscribe?.({ key: "agent:main:main" });
    await Promise.resolve();
    gatewayCalls.length = 0;

    resolveFirstSubscribe?.({ key: "agent:main:main" });
    await Promise.resolve();
    await Promise.resolve();

    expect(gatewayCalls).toEqual([]);
  });

  test("unsubscribes the selected-session message stream on cleanup", async () => {
    unsubscribeFromChatEvents();
    effectiveSessionKey.value = "agent:main:main";
    subscribeToChatEvents();
    await Promise.resolve();
    gatewayCalls.length = 0;

    unsubscribeFromChatEvents();
    await Promise.resolve();

    expect(gatewayCalls).toEqual([
      {
        method: "sessions.messages.unsubscribe",
        params: { key: "agent:main:main" },
      },
    ]);
  });

  test("continues chat event setup when selected-session message subscription is unavailable", async () => {
    unsubscribeFromChatEvents();
    effectiveSessionKey.value = "agent:main:main";
    capabilities.value = ["chat.history"];

    subscribeToChatEvents();
    await Promise.resolve();

    expect(namedHandlers.has("chat")).toBe(true);
    expect(namedHandlers.has("agent")).toBe(true);
    expect(gatewayHandlers).toHaveLength(1);
    expect(gatewayCalls).not.toContainEqual({
      method: "sessions.messages.subscribe",
      params: { key: "agent:main:main" },
    });
  });

  test("reloads active-session history when a subscribed session message arrives", async () => {
    effectiveSessionKey.value = "agent:main:main";
    capabilities.value = [
      "chat.startup",
      "sessions.messages.subscribe",
      "sessions.messages.unsubscribe",
    ];
    gatewayCalls.length = 0;

    emitGatewayEvent("session.message", { sessionKey: "agent:main:main" }, 7);
    timers.advanceBy(100);
    await Promise.resolve();

    expect(gatewayCalls).toContainEqual({
      method: "chat.startup",
      params: { sessionKey: "agent:main:main", limit: 200 },
    });
  });

  test("ignores inactive-session message events without loading history", async () => {
    effectiveSessionKey.value = "agent:main:main";
    activeSessionMatches = false;
    capabilities.value = [
      "chat.startup",
      "sessions.messages.subscribe",
      "sessions.messages.unsubscribe",
    ];
    gatewayCalls.length = 0;

    emitGatewayEvent("session.message", { sessionKey: "agent:main:other" }, 7);
    timers.advanceBy(1_000);
    await Promise.resolve();

    expect(gatewayCalls).toEqual([]);
  });

  test("coalesces active-session message bursts into one history refresh", async () => {
    effectiveSessionKey.value = "agent:main:main";
    capabilities.value = [
      "chat.startup",
      "sessions.messages.subscribe",
      "sessions.messages.unsubscribe",
    ];
    gatewayCalls.length = 0;

    emitGatewayEvent("session.message", { sessionKey: "agent:main:main" }, 7);
    emitGatewayEvent("session.message", { sessionKey: "agent:main:main" }, 8);
    emitGatewayEvent("session.message", { sessionKey: "agent:main:main" }, 9);
    await Promise.resolve();

    expect(gatewayCalls).toEqual([]);

    timers.advanceBy(100);
    await Promise.resolve();

    expect(gatewayCalls).toEqual([
      {
        method: "chat.startup",
        params: { sessionKey: "agent:main:main", limit: 200 },
      },
    ]);
  });

  test("defers active-session message refreshes while the session has a pending run", async () => {
    effectiveSessionKey.value = "agent:main:main";
    capabilities.value = [
      "chat.startup",
      "sessions.messages.subscribe",
      "sessions.messages.unsubscribe",
    ];
    chat.startRun("run-active", "agent:main:main");
    gatewayCalls.length = 0;

    emitGatewayEvent("session.message", { sessionKey: "agent:main:main" }, 7);
    timers.advanceBy(999);
    await Promise.resolve();

    expect(gatewayCalls).toEqual([]);

    chat.completeRun("run-active");
    timers.advanceBy(1);
    await Promise.resolve();

    expect(gatewayCalls).toEqual([
      {
        method: "chat.startup",
        params: { sessionKey: "agent:main:main", limit: 200 },
      },
    ]);
  });

  test("defers active-session message refreshes when the payload reports an active run", async () => {
    effectiveSessionKey.value = "agent:main:main";
    capabilities.value = [
      "chat.startup",
      "sessions.messages.subscribe",
      "sessions.messages.unsubscribe",
    ];
    gatewayCalls.length = 0;

    emitGatewayEvent("session.message", { sessionKey: "agent:main:main", hasActiveRun: true }, 7);
    timers.advanceBy(999);
    await Promise.resolve();

    expect(gatewayCalls).toEqual([]);

    timers.advanceBy(1);
    await Promise.resolve();

    expect(gatewayCalls).toEqual([
      {
        method: "chat.startup",
        params: { sessionKey: "agent:main:main", limit: 200 },
      },
    ]);
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

  test("does not append a late reset final after authoritative history reloads", () => {
    registerResetRun("reset-run");
    chat.messages.value = [
      {
        id: "hist-reset",
        role: "assistant",
        content: "New session started.",
        timestamp: 1000,
        isStreaming: false,
      },
    ];

    emitChat({
      runId: "reset-run",
      state: "final",
      message: { role: "assistant", content: "New session started.", timestamp: 1100 },
    });

    expect(chat.messages.value).toEqual([
      expect.objectContaining({
        id: "hist-reset",
        role: "assistant",
        content: "New session started.",
      }),
    ]);
  });

  test("cleans up reset markers after lifecycle-only completion and drops a later final", () => {
    registerResetRun("reset-run");

    emitAgent({
      runId: "reset-run",
      stream: "lifecycle",
      data: { phase: "start" },
    });
    emitAgent({
      runId: "reset-run",
      stream: "lifecycle",
      data: { phase: "end" },
    });

    expect(consumeResetRun("reset-run")).toBe(false);
    expect(chat.activeRuns.value.get("reset-run")).toMatchObject({ status: "complete" });

    emitChat({
      runId: "reset-run",
      state: "final",
      message: { role: "assistant", content: "New session started.", timestamp: 1100 },
    });

    expect(chat.messages.value).toEqual([]);
  });

  test("clears reset and delta fallback state when a reset final is deferred", () => {
    registerResetRun("reset-run");

    emitChat({ runId: "reset-run", state: "delta", deltaText: "New session started." });
    expect(chat.activeRuns.value.get("reset-run")).toMatchObject({
      content: "New session started.",
      status: "streaming",
    });

    emitChat({
      runId: "reset-run",
      state: "final",
      message: { role: "assistant", content: "New session started.", timestamp: 1100 },
    });
    emitChat({ runId: "reset-run", state: "delta", deltaText: "duplicate" });

    expect(chat.messages.value).toEqual([]);
    expect(chat.activeRuns.value.get("reset-run")).toMatchObject({
      content: "New session started.",
      status: "complete",
    });
  });

  test("clears reset markers on unsubscribe and drops a late reset final after resubscribe", () => {
    registerResetRun("reset-run");

    unsubscribeFromChatEvents();
    subscribeToChatEvents();
    emitChat({
      runId: "reset-run",
      state: "final",
      message: { role: "assistant", content: "New session started.", timestamp: 1100 },
    });

    expect(chat.messages.value).toEqual([]);
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
