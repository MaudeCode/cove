import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { signal } from "@preact/signals";
import { installI18nMock } from "../../../helpers/i18n";
import { createGatewayMock, createSessionSignalsMock } from "../../../helpers/module-mocks";
import { installFakeTimers, type FakeTimers } from "../../../helpers/timers";
import { installStorageMocks } from "../../../helpers/storage";
import type { AttachmentPayload } from "../../../../src/types/attachments";
import type { Message } from "../../../../src/types/messages";
import type { ChatEvent } from "../../../../src/types/chat";

(globalThis as { __APP_VERSION__?: string }).__APP_VERSION__ = "test";

type GatewayResponse = unknown | ((method: string, params: unknown) => unknown | Promise<unknown>);
type NamedHandler = (payload: unknown) => void;

const isConnected = signal(true);
const mainSessionKey = signal<string | null>("main");
const sessions = signal<Array<{ key: string; label?: string }>>([]);
const gatewayResponses = new Map<string, GatewayResponse>();
const gatewayCalls: Array<{ method: string; params: unknown }> = [];
const autoRenameCalls: Array<{ message: string; sessionKey: string }> = [];
const historyLoads: string[] = [];
const namedHandlers = new Map<string, NamedHandler>();
let historyLoadError: Error | null = null;
let historyMessagesAfterLoad: Message[] = [];

const gatewaySend = mock(async (method: string, params?: unknown) => {
  gatewayCalls.push({ method, params });
  const response = gatewayResponses.get(method);
  if (response instanceof Error) throw response;
  if (typeof response === "function") {
    return response(method, params);
  }
  if (response !== undefined) return response;
  throw new Error(`Unexpected gateway method: ${method}`);
});

const constants = await import("../../../../src/lib/constants");
const debouncedSignal = await import("../../../../src/lib/debounced-signal");
const messageDetection = await import("../../../../src/lib/message-detection");
const storage = await import("../../../../src/lib/storage");
const streaming = await import("../../../../src/lib/streaming");
const toolUtils = await import("../../../../src/lib/tool-utils");
const typeGuards = await import("../../../../src/lib/type-guards");
const utils = await import("../../../../src/lib/utils");

mock.module("@/lib/gateway", () =>
  createGatewayMock({
    isConnected,
    mainSessionKey,
    send: gatewaySend,
    on: (event: unknown, handler: unknown) => {
      namedHandlers.set(String(event), handler as NamedHandler);
      return () => namedHandlers.delete(String(event));
    },
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
mock.module("@/lib/streaming", () => streaming);
mock.module("@/lib/tool-utils", () => toolUtils);
mock.module("@/lib/type-guards", () => typeGuards);
mock.module("@/lib/utils", () => utils);
const typesChat = await import("../../../../src/types/chat");
mock.module("@/types/chat", () => typesChat);
mock.module("@/signals/sessions", () => createSessionSignalsMock({ sessions }));
mock.module("@/lib/session-utils", () => ({
  getErrorMessage: (err: unknown) => (err instanceof Error ? err.message : String(err)),
  getAgentId: (sessionKey: string) => {
    const parts = sessionKey.split(":");
    return parts.length >= 2 && parts[0] === "agent" ? parts[1] : null;
  },
  isUserCreatedChat: (sessionKey: string) => /^agent:[^:]+:chat:[^:]+$/.test(sessionKey),
}));
installI18nMock({ t: (key: string) => (key === "common.newChat" ? "New Chat" : key) });
mock.module("../../../../src/lib/chat/auto-rename", () => ({
  autoRenameSession: async (sessionKey: string, messageText: string) => {
    autoRenameCalls.push({ sessionKey, message: messageText });
  },
}));
mock.module("../../../../src/lib/chat/history", () => ({
  loadHistory: async (sessionKey: string) => {
    historyLoads.push(sessionKey);
    if (historyLoadError) {
      throw historyLoadError;
    }
    chat.messages.value = historyMessagesAfterLoad;
  },
}));

const chat = await import("../../../../src/signals/chat");
mock.module("@/signals/chat", () => chat);
const {
  abortChat,
  clearPendingAborts,
  processMessageQueue,
  processNextQueuedMessage,
  retryMessage,
  sendMessage,
} = await import("../../../../src/lib/chat/send");
const { subscribeToChatEvents, unsubscribeFromChatEvents } =
  await import("../../../../src/lib/chat/events");

function emitChat(event: Partial<ChatEvent> & Pick<ChatEvent, "runId" | "state">): void {
  namedHandlers.get("chat")?.({
    sessionKey: "session-1",
    seq: 1,
    ...event,
  });
}

function queuedMessage(overrides: Partial<Message>): Message {
  return {
    id: "user_retry-key",
    role: "user",
    content: "hello",
    timestamp: 1000,
    isStreaming: false,
    sessionKey: "session-1",
    status: "queued",
    ...overrides,
  };
}

function attachment(type: AttachmentPayload["type"], fileName: string): AttachmentPayload {
  const mimeType = type === "image" ? "image/png" : "text/plain";
  return {
    type,
    mimeType,
    fileName,
    content: `data:${mimeType};base64,a`,
  };
}

describe("chat send queue", () => {
  let timers: FakeTimers;
  let restoreStorage: (() => void) | undefined;

  beforeEach(() => {
    restoreStorage = installStorageMocks();
    timers = installFakeTimers(1_700_000_000_000);
    isConnected.value = true;
    sessions.value = [];
    gatewayCalls.length = 0;
    autoRenameCalls.length = 0;
    historyLoads.length = 0;
    namedHandlers.clear();
    historyLoadError = null;
    historyMessagesAfterLoad = [];
    gatewayResponses.clear();
    gatewayResponses.set("chat.send", { runId: "run-1", status: "started" });
    chat.messages.value = [];
    chat.messageQueue.value = [];
    chat.activeRuns.value = new Map();
    chat.searchQuery.value = "";
    chat.dateRangeStart.value = null;
    chat.dateRangeEnd.value = null;
    chat.chatDrafts.value = new Map();
    clearPendingAborts();
    unsubscribeFromChatEvents();
    subscribeToChatEvents();
  });

  afterEach(() => {
    unsubscribeFromChatEvents();
    timers.uninstall();
    restoreStorage?.();
  });

  test("queues disconnected messages with image previews and sends attachments later", async () => {
    isConnected.value = false;
    const attachments = [attachment("image", "a.png"), attachment("file", "a.txt")];

    const key = await sendMessage("session-1", "hello", { attachments });

    expect(chat.messages.value).toEqual([]);
    expect(chat.messageQueue.value).toEqual([
      expect.objectContaining({
        content: "hello",
        id: `user_${key}`,
        images: [{ url: "data:image/png;base64,a", alt: "a.png" }],
        pendingAttachments: attachments,
        status: "queued",
      }),
    ]);

    isConnected.value = true;
    await processMessageQueue();

    expect(chat.messageQueue.value).toEqual([]);
    expect(chat.messages.value[0]).toMatchObject({ id: `user_${key}`, status: "sent" });
    expect(gatewayCalls[0]).toMatchObject({
      method: "chat.send",
      params: expect.objectContaining({
        attachments,
        idempotencyKey: key,
        message: "hello",
      }),
    });
  });

  test("resends image-only queued messages as attachment payloads", async () => {
    chat.queueMessage(
      queuedMessage({
        id: "user_image-only-key",
        images: [{ url: "data:image/png;base64,image-only", alt: "image-only.png" }],
        pendingAttachments: undefined,
      }),
    );

    await processMessageQueue();

    expect(gatewayCalls[0]).toMatchObject({
      method: "chat.send",
      params: expect.objectContaining({
        attachments: [
          {
            content: "data:image/png;base64,image-only",
            fileName: "image-only.png",
            mimeType: "image/png",
            type: "image",
          },
        ],
        idempotencyKey: "image-only-key",
        message: "hello",
      }),
    });
  });

  test("does not resend omitted or empty legacy image placeholders", async () => {
    chat.queueMessage(
      queuedMessage({
        id: "user_omitted-image-key",
        images: [
          { url: "", alt: "omitted.png", omitted: true, bytes: 1024 },
          { url: "   ", alt: "empty.png" },
        ],
        pendingAttachments: undefined,
      }),
    );

    await processMessageQueue();

    expect(gatewayCalls[0].params).toMatchObject({
      attachments: undefined,
      idempotencyKey: "omitted-image-key",
      message: "hello",
    });
  });

  test("respects an explicit empty queued attachment payload", async () => {
    chat.queueMessage(
      queuedMessage({
        id: "user_removed-attachments-key",
        images: [{ url: "data:image/png;base64,stale", alt: "stale.png" }],
        pendingAttachments: [],
      }),
    );

    await processMessageQueue();

    expect(gatewayCalls[0].params).toMatchObject({
      attachments: undefined,
      idempotencyKey: "removed-attachments-key",
    });
  });

  test("queues new sends while streaming and processes only the matching session later", async () => {
    chat.startRun("run-active", "session-1");
    const attachments = [attachment("image", "busy.png"), attachment("file", "busy.txt")];

    const queuedKey = await sendMessage("session-1", "queued while streaming", { attachments });
    chat.queueMessage(queuedMessage({ id: "user_other", sessionKey: "other", content: "other" }));

    expect(chat.messageQueue.value.map((msg) => msg.id)).toEqual([
      `user_${queuedKey}`,
      "user_other",
    ]);
    expect(gatewayCalls).toEqual([]);

    chat.activeRuns.value = new Map();
    await processNextQueuedMessage("session-1");

    expect(chat.messageQueue.value.map((msg) => msg.id)).toEqual(["user_other"]);
    expect(gatewayCalls).toHaveLength(1);
    expect(gatewayCalls[0].params).toMatchObject({
      attachments,
      idempotencyKey: queuedKey,
      message: "queued while streaming",
    });
  });

  test("retry uses the original idempotency key and does not duplicate the user message", async () => {
    const attachments = [attachment("image", "retry.png"), attachment("file", "retry.txt")];
    chat.messages.value = [
      queuedMessage({
        id: "user_original-key",
        content: "retry me",
        pendingAttachments: attachments,
        sessionKey: "session-1",
        status: "failed",
      }),
    ];

    await retryMessage("user_original-key");

    expect(chat.messages.value).toHaveLength(1);
    expect(chat.messages.value[0]).toMatchObject({ id: "user_original-key", status: "sent" });
    expect(gatewayCalls[0].params).toMatchObject({
      attachments,
      idempotencyKey: "original-key",
      message: "retry me",
    });
  });

  test("adopts the gateway ack run id for the optimistic active run", async () => {
    gatewayResponses.set("chat.send", { runId: "gateway-run", status: "started" });

    const optimisticRunId = await sendMessage("session-1", "hello");

    expect(chat.activeRuns.value.has(optimisticRunId)).toBe(false);
    expect(chat.activeRuns.value.get("gateway-run")).toMatchObject({
      runId: "gateway-run",
      sessionKey: "session-1",
      status: "pending",
    });

    emitChat({
      runId: "gateway-run",
      state: "delta",
      deltaText: "Hello",
    });
    emitChat({
      runId: "gateway-run",
      state: "final",
      message: { role: "assistant", content: "Hello", timestamp: 1200 },
    });

    expect([...chat.activeRuns.value.keys()]).toEqual(["gateway-run"]);
    expect(chat.activeRuns.value.get("gateway-run")).toMatchObject({
      content: "Hello",
      status: "complete",
    });
    expect(chat.messages.value.map((msg) => msg.id)).toEqual([
      `user_${optimisticRunId}`,
      "assistant_gateway-run",
    ]);
  });

  test("aborts the active run with session, run, and agent scope", async () => {
    gatewayResponses.set("sessions.abort", { ok: true });
    chat.startRun("gateway-run", "agent:main:chat:abc");

    await abortChat("agent:main:chat:abc");

    expect(gatewayCalls).toEqual([
      {
        method: "sessions.abort",
        params: {
          agentId: "main",
          key: "agent:main:chat:abc",
          runId: "gateway-run",
        },
      },
    ]);
  });

  test("aborts a session without run scope when no run is active", async () => {
    gatewayResponses.set("sessions.abort", { ok: true });

    await abortChat("agent:maude-pm:main");

    expect(gatewayCalls).toEqual([
      {
        method: "sessions.abort",
        params: {
          agentId: "maude-pm",
          key: "agent:maude-pm:main",
        },
      },
    ]);
  });

  test("replays pending aborts before queued messages after reconnect", async () => {
    gatewayResponses.set("sessions.abort", { ok: true });
    const sessionKey = "agent:main:chat:abc";
    isConnected.value = false;
    chat.startRun("pending-run", sessionKey);

    await abortChat(sessionKey);

    expect(gatewayCalls).toEqual([]);
    chat.queueMessage(queuedMessage({ id: "user_after-abort", sessionKey, content: "later" }));

    isConnected.value = true;
    await processMessageQueue();

    expect(gatewayCalls.map((call) => call.method)).toEqual(["sessions.abort", "chat.send"]);
    expect(gatewayCalls[0].params).toEqual({
      agentId: "main",
      key: sessionKey,
      runId: "pending-run",
    });
    expect(gatewayCalls[1].params).toMatchObject({
      idempotencyKey: "after-abort",
      message: "later",
      sessionKey,
    });
  });

  test("replays pending aborts on reconnect without queued messages", async () => {
    gatewayResponses.set("sessions.abort", { ok: true });
    const sessionKey = "agent:main:chat:abc";
    isConnected.value = false;
    chat.startRun("pending-run", sessionKey);

    await abortChat(sessionKey);

    expect(gatewayCalls).toEqual([]);

    isConnected.value = true;
    await flushPromises();

    expect(chat.messageQueue.value).toEqual([]);
    expect(gatewayCalls).toEqual([
      {
        method: "sessions.abort",
        params: {
          agentId: "main",
          key: sessionKey,
          runId: "pending-run",
        },
      },
    ]);
  });

  test("keeps queued messages pending when abort replay fails", async () => {
    gatewayResponses.set("sessions.abort", new Error("abort unavailable"));
    const sessionKey = "agent:main:chat:abc";
    isConnected.value = false;
    chat.startRun("pending-run", sessionKey);

    await abortChat(sessionKey);
    chat.queueMessage(
      queuedMessage({ id: "user_after-failed-abort", sessionKey, content: "later" }),
    );

    isConnected.value = true;
    await processMessageQueue();

    expect(gatewayCalls.map((call) => call.method)).toEqual(["sessions.abort"]);
    expect(chat.messageQueue.value.map((message) => message.id)).toEqual([
      "user_after-failed-abort",
    ]);
  });

  test("gateway errors mark messages and runs failed", async () => {
    gatewayResponses.set("chat.send", { status: "error", summary: "gateway refused" });

    await expect(sendMessage("session-1", "bad")).rejects.toThrow("gateway refused");

    expect(chat.messages.value[0]).toMatchObject({
      content: "bad",
      error: "gateway refused",
      status: "failed",
    });
    expect(chat.activeRuns.value.values().next().value).toMatchObject({
      error: "gateway refused",
      status: "error",
    });
  });

  test("/new reset clears messages after send and reloads history", async () => {
    chat.messages.value = [queuedMessage({ id: "existing", status: "sent" })];

    await sendMessage("session-1", "/new");
    expect(chat.messages.value.length).toBe(2);

    timers.advanceBy(100);
    await Promise.resolve();

    expect(chat.messages.value).toEqual([]);
    expect(historyLoads).toEqual(["session-1"]);
  });

  test("/new reset drops final fallback when authoritative history reload succeeds", async () => {
    gatewayResponses.set("chat.send", { runId: "reset-run", status: "started" });
    historyMessagesAfterLoad = [
      {
        id: "hist-reset",
        role: "assistant",
        content: "New session started.",
        timestamp: 1100,
        isStreaming: false,
      },
    ];

    await sendMessage("session-1", "/new");
    emitChat({
      runId: "reset-run",
      state: "final",
      message: { role: "assistant", content: "New session started.", timestamp: 1200 },
    });

    timers.advanceBy(100);
    await Promise.resolve();
    await Promise.resolve();

    expect(historyLoads).toEqual(["session-1"]);
    expect(chat.messages.value).toEqual([
      expect.objectContaining({
        id: "hist-reset",
        content: "New session started.",
      }),
    ]);
    expect(chat.activeRuns.value.has("reset-run")).toBe(false);
  });

  test("/new reset shows final fallback when authoritative history reload fails", async () => {
    gatewayResponses.set("chat.send", { runId: "reset-run", status: "started" });
    historyLoadError = new Error("history down");

    await sendMessage("session-1", "/new");
    emitChat({
      runId: "reset-run",
      state: "final",
      message: { role: "assistant", content: "New session started.", timestamp: 1200 },
    });

    timers.advanceBy(100);
    await Promise.resolve();
    await Promise.resolve();

    expect(historyLoads).toEqual(["session-1"]);
    expect(chat.messages.value).toEqual([
      expect.objectContaining({
        id: "assistant_reset-run",
        role: "assistant",
        content: "New session started.",
      }),
    ]);
    expect(chat.activeRuns.value.has("reset-run")).toBe(false);

    emitChat({
      runId: "reset-run",
      state: "final",
      message: { role: "assistant", content: "New session started.", timestamp: 1300 },
    });

    expect(chat.messages.value).toHaveLength(1);
  });

  test("first message in new user-created chat triggers auto-rename", async () => {
    sessions.value = [{ key: "agent:main:chat:abc", label: "New Chat" }];

    await sendMessage("agent:main:chat:abc", "Rename this session");

    expect(autoRenameCalls).toEqual([
      { sessionKey: "agent:main:chat:abc", message: "Rename this session" },
    ]);
  });
});

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
