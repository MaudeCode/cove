import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { signal } from "@preact/signals";
import { createGatewayMock, createSessionSignalsMock } from "../../../helpers/module-mocks";
import { installStorageMocks } from "../../../helpers/storage";
import type { ChatHistoryResult, ChatStartupResult } from "../../../../src/types/chat";
import type { Message } from "../../../../src/types/messages";

(globalThis as { __APP_VERSION__?: string }).__APP_VERSION__ = "test";

type GatewayCall = { method: string; params: unknown };
type GatewayHarness = {
  send?: (method: string, params?: unknown) => unknown;
};

const gatewayCalls: GatewayCall[] = [];
let gatewayResponse:
  | Promise<ChatHistoryResult | ChatStartupResult>
  | ChatHistoryResult
  | ChatStartupResult;
let activeSessionMatches = true;
let activeSessionKey = "session-1";
const isConnected = signal(true);
const mainSessionKey = signal<string | null>("main");
const capabilities = signal<string[]>(["chat.history"]);
const gatewayHarness = ((
  globalThis as { __coveGatewayHarness?: GatewayHarness }
).__coveGatewayHarness ??= {});

const gatewaySend = mock((method: string, params?: unknown) => {
  gatewayCalls.push({ method, params });
  return gatewayResponse;
});

class RpcError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "GatewayRpcError";
    this.code = code;
  }
}

function gatewayResponsesForTest(responses: unknown[]): void {
  const queued = [...responses];
  gatewayHarness.send = mock((method: string, params?: unknown) => {
    gatewayCalls.push({ method, params });
    const response = queued.shift();
    if (response instanceof Error) throw response;
    return response;
  });
}

const constants = await import("../../../../src/lib/constants");
const debouncedSignal = await import("../../../../src/lib/debounced-signal");
const messageDetection = await import("../../../../src/lib/message-detection");
const storage = await import("../../../../src/lib/storage");
const toolUtils = await import("../../../../src/lib/tool-utils");

mock.module("@/lib/gateway", () =>
  createGatewayMock({
    capabilities,
    isConnected,
    mainSessionKey,
    send: (method: string, params?: unknown) => gatewayHarness.send?.(method, params),
  }),
);
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
mock.module("@/lib/tool-utils", () => toolUtils);
const typesChat = await import("../../../../src/types/chat");
mock.module("@/types/chat", () => typesChat);
mock.module("@/signals/sessions", () =>
  createSessionSignalsMock({
    isForActiveSession: (sessionKey) => activeSessionMatches && sessionKey === activeSessionKey,
  }),
);

const chat = await import("../../../../src/signals/chat");
mock.module("@/signals/chat", () => chat);
const modelSignals = await import("../../../../src/signals/models");
mock.module("@/signals/models", () => modelSignals);
const { loadHistory } = await import("../../../../src/lib/chat/history");

function queuedMessage(overrides: Partial<Message>): Message {
  return {
    id: "user_queued",
    role: "user",
    content: "queued",
    timestamp: 1000,
    isStreaming: false,
    sessionKey: "session-1",
    status: "queued",
    ...overrides,
  };
}

describe("loadHistory", () => {
  let restoreStorage: (() => void) | undefined;

  beforeEach(() => {
    restoreStorage = installStorageMocks();
    gatewayCalls.length = 0;
    gatewayResponse = {
      sessionKey: "session-1",
      thinkingLevel: "high",
      messages: [{ role: "assistant", content: "loaded", timestamp: 1000 }],
    };
    activeSessionMatches = true;
    activeSessionKey = "session-1";
    capabilities.value = ["chat.history"];
    gatewayHarness.send = gatewaySend;
    chat.messages.value = [];
    chat.messageQueue.value = [];
    chat.activeRuns.value = new Map();
    chat.startupActiveRunSessions.value = new Set();
    chat.historyError.value = null;
    chat.isLoadingHistory.value = false;
    chat.thinkingLevel.value = "off";
    modelSignals.models.value = [];
    modelSignals.defaultModel.value = null;
  });

  afterEach(() => {
    gatewayHarness.send = undefined;
    restoreStorage?.();
  });

  test("deduplicates concurrent loads for the same session", async () => {
    const deferred = Promise.withResolvers<ChatHistoryResult>();
    gatewayResponse = deferred.promise;

    const first = loadHistory("session-1", 5);
    const second = loadHistory("session-1", 20);

    expect(gatewayCalls).toEqual([
      { method: "chat.history", params: { sessionKey: "session-1", limit: 5 } },
    ]);
    expect(chat.isLoadingHistory.value).toBe(true);

    deferred.resolve({
      sessionKey: "session-1",
      messages: [{ role: "assistant", content: "loaded once", timestamp: 1000 }],
    });
    await Promise.all([first, second]);

    expect(chat.isLoadingHistory.value).toBe(false);
    expect(chat.messages.value).toEqual([
      expect.objectContaining({ role: "assistant", content: "loaded once" }),
    ]);
  });

  test("stores normalized history, cache, and thinking level", async () => {
    await loadHistory("session-1", 7);

    expect(gatewayCalls).toEqual([
      { method: "chat.history", params: { sessionKey: "session-1", limit: 7 } },
    ]);
    expect(chat.messages.value).toEqual([
      expect.objectContaining({ role: "assistant", content: "loaded" }),
    ]);
    expect(chat.thinkingLevel.value).toBe("high");
    expect(JSON.parse(localStorage.getItem("cove:messages-cache") ?? "[]")).toEqual([
      expect.objectContaining({ role: "assistant", content: "loaded" }),
    ]);
    expect(localStorage.getItem("cove:messages-session")).toBe(JSON.stringify("session-1"));
  });

  test("hydrates from chat.startup when advertised and prefers sessionInfo thinking", async () => {
    capabilities.value = ["chat.startup", "chat.history"];
    gatewayResponse = {
      sessionKey: "session-1",
      thinkingLevel: "low",
      sessionInfo: { thinkingLevel: "high" },
      metadata: {
        models: [{ id: "openai/gpt-5.4", name: "GPT 5.4", provider: "openai" }],
      },
      messages: [{ role: "assistant", content: "startup loaded", timestamp: 1000 }],
    };

    await loadHistory("session-1", 7);

    expect(gatewayCalls).toEqual([
      { method: "chat.startup", params: { sessionKey: "session-1", limit: 7 } },
    ]);
    expect(chat.messages.value).toEqual([
      expect.objectContaining({ role: "assistant", content: "startup loaded" }),
    ]);
    expect(chat.thinkingLevel.value).toBe("high");
    expect(modelSignals.models.value).toEqual([
      { id: "openai/gpt-5.4", name: "GPT 5.4", provider: "openai" },
    ]);
  });

  test("preserves persisted steered queue items for startup in-flight runs", async () => {
    capabilities.value = ["chat.startup", "chat.history"];
    chat.queueMessage(
      queuedMessage({
        id: "user_steer",
        content: "use the narrow fix",
        pendingRunId: "run-active",
        queueKind: "steered",
        status: "sent",
      }),
    );
    gatewayResponse = {
      sessionKey: "session-1",
      sessionInfo: { hasActiveRun: true },
      inFlightRun: { runId: "run-active" },
      messages: [{ role: "assistant", content: "working", timestamp: 1000 }],
    };

    await loadHistory("session-1", 7);

    expect(chat.activeRuns.value.get("run-active")).toMatchObject({
      runId: "run-active",
      sessionKey: "session-1",
      status: "pending",
    });
    expect(chat.messageQueue.value).toEqual([
      expect.objectContaining({
        id: "user_steer",
        pendingRunId: "run-active",
        queueKind: "steered",
      }),
    ]);
    expect(chat.hasStartupActiveRun("session-1")).toBe(false);
  });

  test("blocks sends when startup reports an active run without a run id", async () => {
    capabilities.value = ["chat.startup", "chat.history"];
    chat.queueMessage(
      queuedMessage({
        id: "user_steer",
        content: "use the narrow fix",
        pendingRunId: "run-active",
        queueKind: "steered",
        status: "sent",
      }),
    );
    gatewayResponse = {
      sessionKey: "session-1",
      sessionInfo: { hasActiveRun: true },
      messages: [{ role: "assistant", content: "working", timestamp: 1000 }],
    };

    await loadHistory("session-1", 7);

    expect(chat.hasStartupActiveRun("session-1")).toBe(true);
    expect(chat.activeRuns.value.size).toBe(0);
    expect(chat.messageQueue.value).toEqual([
      expect.objectContaining({
        id: "user_steer",
        pendingRunId: "run-active",
        queueKind: "steered",
      }),
    ]);
  });

  test("prunes stale persisted steered queue items when startup has no active run", async () => {
    capabilities.value = ["chat.startup", "chat.history"];
    chat.queueMessage(
      queuedMessage({
        id: "user_stale-steer",
        content: "old guidance",
        pendingRunId: "run-gone",
        queueKind: "steered",
        status: "sent",
      }),
    );
    gatewayResponse = {
      sessionKey: "session-1",
      sessionInfo: { hasActiveRun: false },
      messages: [{ role: "assistant", content: "done", timestamp: 1000 }],
    };

    await loadHistory("session-1", 7);

    expect(chat.messageQueue.value).toEqual([]);
    expect(chat.hasStartupActiveRun("session-1")).toBe(false);
  });

  test("falls back to chat.history when chat.startup is unknown", async () => {
    capabilities.value = [];
    gatewayResponsesForTest([
      new RpcError("INVALID_REQUEST", "unknown method: chat.startup"),
      {
        sessionKey: "session-1",
        thinkingLevel: "medium",
        messages: [{ role: "assistant", content: "history fallback", timestamp: 1000 }],
      },
    ]);

    await loadHistory("session-1", 7);

    expect(gatewayCalls).toEqual([
      { method: "chat.startup", params: { sessionKey: "session-1", limit: 7 } },
      { method: "chat.history", params: { sessionKey: "session-1", limit: 7 } },
    ]);
    expect(chat.messages.value).toEqual([
      expect.objectContaining({ role: "assistant", content: "history fallback" }),
    ]);
    expect(chat.thinkingLevel.value).toBe("medium");
  });

  test("does not fall back for non-method chat.startup not found failures", async () => {
    capabilities.value = [];
    gatewayResponsesForTest([new RpcError("NOT_FOUND", "session not found")]);

    await expect(loadHistory("session-1", 7)).rejects.toThrow("session not found");

    expect(gatewayCalls).toEqual([
      { method: "chat.startup", params: { sessionKey: "session-1", limit: 7 } },
    ]);
  });

  test("preserves unresolved local tail messages when history is stale", async () => {
    chat.messages.value = [
      {
        id: "user_tail",
        role: "user",
        content: "still sending",
        timestamp: 1200,
        isStreaming: false,
        status: "sending",
        sessionKey: "session-1",
      },
    ];

    await loadHistory("session-1", 7);

    expect(chat.messages.value.map((message) => message.id)).toEqual([
      expect.stringMatching(/^hist_0_/),
      "user_tail",
    ]);
    expect(JSON.parse(localStorage.getItem("cove:messages-cache") ?? "[]")).toEqual([
      expect.objectContaining({ role: "assistant", content: "loaded" }),
      expect.objectContaining({ id: "user_tail", content: "still sending", status: "sending" }),
    ]);
  });

  test("ignores stale history responses for inactive sessions", async () => {
    activeSessionMatches = false;
    chat.messages.value = [
      {
        id: "current",
        role: "assistant",
        content: "current session",
        timestamp: 2000,
        isStreaming: false,
      },
    ];

    await loadHistory("session-1", 7);

    expect(chat.messages.value).toEqual([
      expect.objectContaining({ id: "current", content: "current session" }),
    ]);
    expect(chat.thinkingLevel.value).toBe("off");
    expect(localStorage.getItem("cove:messages-cache")).toBeNull();
  });

  test("keeps loading state while the newest active history load is pending", async () => {
    const oldSession = Promise.withResolvers<ChatHistoryResult>();
    const activeSession = Promise.withResolvers<ChatHistoryResult>();
    const responses = [oldSession.promise, activeSession.promise];
    gatewayHarness.send = mock(() => responses.shift());

    activeSessionKey = "session-1";
    const oldLoad = loadHistory("session-1", 7);
    activeSessionKey = "session-2";
    const activeLoad = loadHistory("session-2", 7);

    oldSession.resolve({
      sessionKey: "session-1",
      messages: [{ role: "assistant", content: "old", timestamp: 1000 }],
    });
    await oldLoad;

    expect(chat.isLoadingHistory.value).toBe(true);
    expect(chat.messages.value).toEqual([]);

    activeSession.resolve({
      sessionKey: "session-2",
      messages: [{ role: "assistant", content: "active", timestamp: 2000 }],
    });
    await activeLoad;

    expect(chat.isLoadingHistory.value).toBe(false);
    expect(chat.messages.value).toEqual([expect.objectContaining({ content: "active" })]);
  });

  test("does not show stale errors from superseded history loads", async () => {
    const oldSession = Promise.withResolvers<ChatHistoryResult>();
    const activeSession = Promise.withResolvers<ChatHistoryResult>();
    const responses = [oldSession.promise, activeSession.promise];
    gatewayHarness.send = mock(() => responses.shift());

    activeSessionKey = "session-1";
    const oldLoad = loadHistory("session-1", 7);
    activeSessionKey = "session-2";
    const activeLoad = loadHistory("session-2", 7);

    oldSession.reject(new Error("old session failed"));
    await expect(oldLoad).rejects.toThrow("old session failed");

    expect(chat.historyError.value).toBeNull();
    expect(chat.isLoadingHistory.value).toBe(true);

    activeSession.resolve({
      sessionKey: "session-2",
      messages: [{ role: "assistant", content: "active", timestamp: 2000 }],
    });
    await activeLoad;

    expect(chat.historyError.value).toBeNull();
    expect(chat.isLoadingHistory.value).toBe(false);
  });

  test("records and rethrows gateway failures", async () => {
    gatewayResponse = Promise.reject(new Error("gateway down"));

    await expect(loadHistory("session-1")).rejects.toThrow("gateway down");

    expect(chat.historyError.value).toBe("gateway down");
    expect(chat.isLoadingHistory.value).toBe(false);
  });
});
