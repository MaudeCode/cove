import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { signal } from "@preact/signals";
import { createGatewayMock, createSessionSignalsMock } from "../../../helpers/module-mocks";
import { installStorageMocks } from "../../../helpers/storage";
import type { ChatHistoryResult } from "../../../../src/types/chat";

(globalThis as { __APP_VERSION__?: string }).__APP_VERSION__ = "test";

type GatewayCall = { method: string; params: unknown };
type GatewayHarness = {
  send?: (method: string, params?: unknown) => unknown;
};

const gatewayCalls: GatewayCall[] = [];
let gatewayResponse: Promise<ChatHistoryResult> | ChatHistoryResult;
const isConnected = signal(true);
const mainSessionKey = signal<string | null>("main");
const gatewayHarness = ((
  globalThis as { __coveGatewayHarness?: GatewayHarness }
).__coveGatewayHarness ??= {});

const gatewaySend = mock((method: string, params?: unknown) => {
  gatewayCalls.push({ method, params });
  return gatewayResponse;
});

const constants = await import("../../../../src/lib/constants");
const debouncedSignal = await import("../../../../src/lib/debounced-signal");
const messageDetection = await import("../../../../src/lib/message-detection");
const storage = await import("../../../../src/lib/storage");
const toolUtils = await import("../../../../src/lib/tool-utils");

mock.module("@/lib/gateway", () =>
  createGatewayMock({
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
mock.module("@/signals/sessions", () => createSessionSignalsMock());

const chat = await import("../../../../src/signals/chat");
mock.module("@/signals/chat", () => chat);
const { loadHistory } = await import("../../../../src/lib/chat/history");

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
    gatewayHarness.send = gatewaySend;
    chat.messages.value = [];
    chat.historyError.value = null;
    chat.isLoadingHistory.value = false;
    chat.thinkingLevel.value = "off";
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

  test("records and rethrows gateway failures", async () => {
    gatewayResponse = Promise.reject(new Error("gateway down"));

    await expect(loadHistory("session-1")).rejects.toThrow("gateway down");

    expect(chat.historyError.value).toBe("gateway down");
    expect(chat.isLoadingHistory.value).toBe(false);
  });
});
