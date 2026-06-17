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
const chatSteeringSettings = signal({ steerByDefault: false });
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
mock.module("@/signals/settings", () => ({
  chatSteeringSettings,
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
    chatSteeringSettings.value = { steerByDefault: false };
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

  test("renders OpenClaw item commentary as live run progress without transcript content", async () => {
    emitAgent({
      runId: "run-commentary",
      stream: "item",
      data: {
        kind: "preamble",
        itemId: "commentary-1",
        title: "commentary",
        progressText: "Inspecting the repository",
      },
    });

    expect(chat.activeRuns.value.get("run-commentary")).toMatchObject({
      content: "",
      commentaryItems: [
        {
          id: "commentary-1",
          seq: 1,
          text: "Inspecting the repository",
        },
      ],
      status: "streaming",
    });

    emitAgent({
      runId: "run-commentary",
      stream: "item",
      data: {
        kind: "preamble",
        itemId: "commentary-1",
        title: "commentary",
        progressText: "Still inspecting",
      },
    });

    expect(chat.activeRuns.value.get("run-commentary")?.commentaryItems).toEqual([
      {
        id: "commentary-1",
        seq: 1,
        text: "Still inspecting",
      },
    ]);

    emitAgent({
      runId: "run-commentary",
      stream: "tool",
      seq: 2,
      data: {
        phase: "result",
        toolCallId: "tool-1",
        name: "read",
        result: "ok",
      },
    });

    emitAgent({
      runId: "run-commentary",
      stream: "lifecycle",
      data: { phase: "end" },
    });

    expect(chat.messages.value).toHaveLength(1);
    const [messageBeforeRefresh] = chat.messages.value;
    expect(messageBeforeRefresh.id).toBe("assistant_run-commentary");
    expect(messageBeforeRefresh.role).toBe("assistant");
    expect(messageBeforeRefresh.content).toBe("");
    expect(messageBeforeRefresh.commentaryItems).toEqual([
      {
        id: "commentary-1",
        seq: 1,
        text: "Still inspecting",
      },
    ]);
    expect(messageBeforeRefresh.toolCalls?.[0]?.id).toBe("tool-1");
    expect(messageBeforeRefresh.toolCalls?.[0]?.name).toBe("read");
    expect(messageBeforeRefresh.toolCalls?.[0]?.seq).toBe(2);
    const completedRun = chat.activeRuns.value.get("run-commentary");
    expect(completedRun?.content).toBe("");
    expect(completedRun?.toolCalls[0]?.id).toBe("tool-1");
    expect(completedRun?.toolCalls[0]?.name).toBe("read");
    expect(completedRun?.toolCalls[0]?.seq).toBe(2);
    expect(completedRun?.commentaryItems).toEqual([
      {
        id: "commentary-1",
        seq: 1,
        text: "Still inspecting",
      },
    ]);
    expect(completedRun?.status).toBe("complete");

    timers.advanceBy(500);
    await flushGatewayTasks();
    expect(
      gatewayCalls.some((call) => call.method === "chat.startup" || call.method === "chat.history"),
    ).toBe(true);
    expect(chat.messages.value).toHaveLength(1);
    const [messageAfterRefresh] = chat.messages.value;
    expect(messageAfterRefresh.id).toBe("assistant_run-commentary");
    expect(messageAfterRefresh.content).toBe("");
    expect(messageAfterRefresh.commentaryItems).toEqual([
      {
        id: "commentary-1",
        seq: 1,
        text: "Still inspecting",
      },
    ]);
    expect(messageAfterRefresh.toolCalls?.[0]?.id).toBe("tool-1");
    expect(messageAfterRefresh.toolCalls?.[0]?.name).toBe("read");
    expect(messageAfterRefresh.toolCalls?.[0]?.seq).toBe(2);
  });

  test("keeps commentary separate from final answer content and tool calls", () => {
    emitAgent({
      runId: "run-final-commentary",
      stream: "item",
      seq: 2,
      data: {
        kind: "preamble",
        itemId: "commentary-before-tool",
        title: "commentary",
        progressText: "Checking files",
      },
    });
    emitAgent({
      runId: "run-final-commentary",
      stream: "tool",
      seq: 3,
      data: {
        phase: "result",
        toolCallId: "tool-1",
        name: "read",
        result: "ok",
      },
    });
    emitChat({
      runId: "run-final-commentary",
      state: "final",
      message: { role: "assistant", content: "Final answer", timestamp: 1234 },
    });

    expect(chat.messages.value).toEqual([
      expect.objectContaining({
        content: "Final answer",
        commentaryItems: [
          {
            id: "commentary-before-tool",
            seq: 2,
            text: "Checking files",
          },
        ],
        toolCalls: [expect.objectContaining({ id: "tool-1", name: "read", seq: 3 })],
      }),
    ]);
  });

  test("keys item commentary by run and sequence when OpenClaw omits itemId", () => {
    emitAgent({
      runId: "run-commentary-seq",
      stream: "item",
      seq: 12,
      data: {
        kind: "preamble",
        title: "commentary",
        progressText: "Checking context",
      },
    });

    expect(chat.activeRuns.value.get("run-commentary-seq")?.commentaryItems).toEqual([
      {
        id: "run-commentary-seq:12",
        seq: 12,
        text: "Checking context",
      },
    ]);
  });

  test("deduplicates repeated commentary text even when replayed with a new item id", () => {
    emitAgent({
      runId: "run-commentary-duplicate",
      stream: "item",
      seq: 10,
      data: {
        kind: "preamble",
        itemId: "commentary-first",
        title: "commentary",
        progressText: "Checking context",
      },
    });
    emitAgent({
      runId: "run-commentary-duplicate",
      stream: "item",
      seq: 11,
      data: {
        kind: "preamble",
        itemId: "commentary-replay",
        title: "commentary",
        progressText: "Checking context",
      },
    });

    expect(chat.activeRuns.value.get("run-commentary-duplicate")?.commentaryItems).toEqual([
      {
        id: "commentary-first",
        seq: 10,
        text: "Checking context",
      },
    ]);

    emitChat({
      runId: "run-commentary-duplicate",
      state: "final",
      message: { role: "assistant", content: "Final answer", timestamp: 1234 },
    });

    expect(chat.messages.value[0]?.commentaryItems).toEqual([
      {
        id: "commentary-first",
        seq: 10,
        text: "Checking context",
      },
    ]);
  });

  test("ignores OpenClaw item commentary outside the active session", () => {
    activeSessionMatches = false;

    emitAgent({
      runId: "run-other-commentary",
      stream: "item",
      sessionKey: "other-session",
      data: {
        kind: "preamble",
        title: "commentary",
        progressText: "Inspecting another session",
      },
    });

    expect(chat.activeRuns.value.has("run-other-commentary")).toBe(false);
  });

  test("preserves assistant commentary phase outside final answer content", () => {
    emitAgent({
      runId: "run-phase-commentary",
      stream: "assistant",
      seq: 3,
      data: { phase: "commentary", text: "Checking files" },
    });

    expect(chat.activeRuns.value.get("run-phase-commentary")).toMatchObject({
      content: "",
      commentaryItems: [
        {
          id: "run-phase-commentary:3",
          seq: 3,
          text: "Checking files",
        },
      ],
    });

    emitAgent({
      runId: "run-phase-commentary",
      stream: "assistant",
      seq: 4,
      data: { phase: "commentary", delta: "Reading output" },
    });

    emitAgent({
      runId: "run-phase-commentary",
      stream: "assistant",
      data: { text: "Final answer" },
    });

    expect(chat.activeRuns.value.get("run-phase-commentary")).toMatchObject({
      content: "Final answer",
    });
    expect(chat.activeRuns.value.get("run-phase-commentary")?.commentaryItems).toEqual([
      {
        id: "run-phase-commentary:3",
        seq: 3,
        text: "Checking files",
      },
      {
        id: "run-phase-commentary:commentary-delta",
        seq: 4,
        text: "Reading output",
      },
    ]);
  });

  test("accumulates assistant commentary delta chunks", () => {
    emitAgent({
      runId: "run-commentary-delta",
      stream: "assistant",
      seq: 3,
      data: { phase: "commentary", itemId: "commentary-stream", delta: "Reading" },
    });
    emitAgent({
      runId: "run-commentary-delta",
      stream: "assistant",
      seq: 4,
      data: { phase: "commentary", itemId: "commentary-stream", delta: " output" },
    });
    emitAgent({
      runId: "run-commentary-delta",
      stream: "assistant",
      seq: 5,
      data: { phase: "commentary", itemId: "commentary-stream", delta: "." },
    });

    expect(chat.activeRuns.value.get("run-commentary-delta")?.commentaryItems).toEqual([
      {
        id: "commentary-stream",
        seq: 3,
        text: "Reading output.",
      },
    ]);
  });

  test("preserves whitespace-only assistant commentary delta chunks", () => {
    emitAgent({
      runId: "run-commentary-whitespace-delta",
      stream: "assistant",
      seq: 3,
      data: { phase: "commentary", itemId: "commentary-stream", delta: "Looking" },
    });
    emitAgent({
      runId: "run-commentary-whitespace-delta",
      stream: "assistant",
      seq: 4,
      data: { phase: "commentary", itemId: "commentary-stream", delta: " " },
    });
    emitAgent({
      runId: "run-commentary-whitespace-delta",
      stream: "assistant",
      seq: 5,
      data: { phase: "commentary", itemId: "commentary-stream", delta: "around" },
    });
    emitAgent({
      runId: "run-commentary-whitespace-delta",
      stream: "assistant",
      seq: 6,
      data: { phase: "commentary", itemId: "commentary-stream", delta: "\n" },
    });
    emitAgent({
      runId: "run-commentary-whitespace-delta",
      stream: "assistant",
      seq: 7,
      data: { phase: "commentary", itemId: "commentary-stream", delta: "again" },
    });

    expect(chat.activeRuns.value.get("run-commentary-whitespace-delta")?.commentaryItems).toEqual([
      {
        id: "commentary-stream",
        seq: 3,
        text: "Looking around\nagain",
      },
    ]);
  });

  test("accumulates assistant commentary deltas without item ids into one progress item", () => {
    emitAgent({
      runId: "run-commentary-delta-no-id",
      stream: "assistant",
      seq: 3,
      data: { phase: "commentary", delta: "Reading" },
    });
    emitAgent({
      runId: "run-commentary-delta-no-id",
      stream: "assistant",
      seq: 4,
      data: { phase: "commentary", delta: " output" },
    });

    expect(chat.activeRuns.value.get("run-commentary-delta-no-id")?.commentaryItems).toEqual([
      {
        id: "run-commentary-delta-no-id:commentary-delta",
        seq: 3,
        text: "Reading output",
      },
    ]);
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

  test("does not duplicate completed tool UI when lifecycle completion, history, and final repeat", () => {
    emitAgent({ runId: "run-repeat-final", stream: "assistant", data: { text: "Done" } });
    emitAgent({
      runId: "run-repeat-final",
      stream: "tool",
      seq: 2,
      data: {
        phase: "result",
        toolCallId: "tool-1",
        name: "read",
        result: "ok",
      },
    });
    emitAgent({
      runId: "run-repeat-final",
      stream: "lifecycle",
      data: { phase: "end" },
    });

    expect(chat.messages.value).toEqual([
      expect.objectContaining({
        id: "assistant_run-repeat-final",
        toolCalls: [expect.objectContaining({ id: "tool-1", result: "ok" })],
      }),
    ]);

    chat.reconcileMessagesFromHistory(
      "session-1",
      [
        {
          id: "hist_run-repeat-final",
          role: "assistant",
          content: "Done",
          timestamp: Date.now(),
          isStreaming: false,
          toolCalls: [
            {
              id: "tool-1",
              name: "read",
              status: "complete",
              result: "ok",
              insertedAtContentLength: 0,
            },
          ],
        },
      ],
      Date.now() - 1,
    );

    emitAgent({
      runId: "run-repeat-final",
      stream: "assistant",
      data: { text: "Done with more detail" },
    });
    emitAgent({
      runId: "run-repeat-final",
      stream: "tool",
      seq: 3,
      data: {
        phase: "result",
        toolCallId: "tool-1",
        name: "read",
        result: "latest ok",
      },
    });
    emitAgent({
      runId: "run-repeat-final",
      stream: "tool",
      seq: 4,
      data: {
        phase: "result",
        toolCallId: "tool-2",
        name: "grep",
        result: "second ok",
      },
    });

    expect(chat.activeRuns.value.get("run-repeat-final")?.status).toBe("streaming");

    emitChat({
      runId: "run-repeat-final",
      state: "final",
      message: { role: "assistant", content: "Done with more detail", timestamp: Date.now() },
    });

    expect(chat.messages.value).toHaveLength(1);
    expect(chat.messages.value[0]).toMatchObject({
      id: "hist_run-repeat-final",
      content: "Done with more detail",
      toolCalls: [
        expect.objectContaining({
          id: "tool-1",
          result: "latest ok",
          status: "complete",
          insertedAtContentLength: 0,
        }),
        expect.objectContaining({
          id: "tool-2",
          result: "second ok",
          status: "complete",
        }),
      ],
    });

    emitAgent({
      runId: "run-repeat-final",
      stream: "tool",
      seq: 5,
      data: {
        phase: "result",
        toolCallId: "tool-1",
        name: "read",
        result: "latest ok",
      },
    });

    expect(chat.activeRuns.value.get("run-repeat-final")?.status).toBe("streaming");

    emitChat({
      runId: "run-repeat-final",
      state: "final",
      message: { role: "assistant", content: "Done", timestamp: Date.now() },
    });

    expect(chat.messages.value).toHaveLength(1);
    expect(chat.messages.value[0]?.content).toBe("Done with more detail");
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
      stream: "item",
      data: {
        kind: "preamble",
        itemId: "reset-commentary",
        title: "commentary",
        progressText: "Resetting session",
      },
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
