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
const capabilities = signal<string[]>(["chat.send", "sessions.abort", "sessions.steer"]);
const chatSteeringSettings = signal({ steerByDefault: false, steeringMode: "soft" });
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
    capabilities,
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
mock.module("@/signals/settings", () => ({
  chatSteeringSettings,
}));
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
  steerQueuedMessage,
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
    chat.isLoadingHistory.value = false;
    chat.searchQuery.value = "";
    chat.dateRangeStart.value = null;
    chat.dateRangeEnd.value = null;
    chat.chatDrafts.value = new Map();
    chatSteeringSettings.value = { steerByDefault: false, steeringMode: "soft" };
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

  test("sends explicit /steer as a pending queue item without replacing the active stream", async () => {
    gatewayResponses.set("chat.send", { runId: "run-active", status: "started" });
    chat.startRun("run-active", "session-1");
    chat.updateRunContent("run-active", "working", [
      { id: "tool-active", name: "read", status: "running" },
    ]);

    const key = await sendMessage("session-1", "/steer use the smaller implementation");

    expect(gatewayCalls).toEqual([
      {
        method: "chat.send",
        params: {
          attachments: undefined,
          deliver: false,
          idempotencyKey: key,
          message: "use the smaller implementation",
          sessionKey: "session-1",
          thinking: undefined,
          timeoutMs: undefined,
        },
      },
    ]);
    expect(chat.messages.value).toEqual([]);
    expect(chat.messageQueue.value).toEqual([
      expect.objectContaining({
        content: "use the smaller implementation",
        id: `user_${key}`,
        pendingRunId: "run-active",
        queueKind: "steered",
        status: "sent",
      }),
    ]);
    expect(chat.activeRuns.value.get("run-active")).toMatchObject({
      content: "working",
      runId: "run-active",
      sessionKey: "session-1",
      toolCalls: [expect.objectContaining({ id: "tool-active" })],
    });
    expect([...chat.activeRuns.value.keys()]).toEqual(["run-active"]);
  });

  test("clears pending soft steering when the active run completes", async () => {
    gatewayResponses.set("chat.send", { runId: "run-active", status: "started" });
    chat.startRun("run-active", "session-1");

    await sendMessage("session-1", "/steer use the smaller implementation");
    expect(chat.messageQueue.value).toHaveLength(1);

    emitChat({
      runId: "run-active",
      state: "final",
      message: { role: "assistant", content: "Done", timestamp: 1200 },
    });

    expect(chat.messageQueue.value).toEqual([]);
    expect(chat.messages.value.at(-1)).toMatchObject({
      role: "assistant",
      content: "Done",
    });
  });

  test("failed fresh soft steering becomes a retryable failed message", async () => {
    gatewayResponses.set("chat.send", new Error("soft steer failed"));
    chat.startRun("run-active", "session-1");

    await expect(sendMessage("session-1", "/steer failing steer")).rejects.toThrow(
      "soft steer failed",
    );

    expect(chat.messageQueue.value).toEqual([
      expect.objectContaining({
        content: "failing steer",
        error: "soft steer failed",
        pendingRunId: undefined,
        queueKind: "steered",
        status: "failed",
        steered: true,
      }),
    ]);

    emitChat({
      runId: "run-active",
      state: "final",
      message: { role: "assistant", content: "Done", timestamp: 1200 },
    });
    await flushPromises();
    await processNextQueuedMessage("session-1");
    await processMessageQueue();

    expect(gatewayCalls).toHaveLength(1);
    expect(chat.messageQueue.value).toEqual([
      expect.objectContaining({
        content: "failing steer",
        error: "soft steer failed",
        status: "failed",
      }),
    ]);
  });

  test("keeps active-run sends queued by default but steers when the setting is enabled", async () => {
    chat.startRun("run-active", "session-1");

    const queuedKey = await sendMessage("session-1", "queue me");
    expect(chat.messageQueue.value.map((message) => message.id)).toEqual([`user_${queuedKey}`]);
    expect(gatewayCalls).toEqual([]);

    chatSteeringSettings.value = { steerByDefault: true, steeringMode: "soft" };
    gatewayResponses.set("chat.send", { runId: "run-active", status: "started" });

    const steeredKey = await sendMessage("session-1", "steer me");

    expect(gatewayCalls).toEqual([
      {
        method: "chat.send",
        params: expect.objectContaining({
          deliver: false,
          idempotencyKey: steeredKey,
          message: "steer me",
          sessionKey: "session-1",
        }),
      },
    ]);
    expect(chat.messageQueue.value).toEqual([
      expect.objectContaining({ id: `user_${queuedKey}`, status: "queued" }),
      expect.objectContaining({
        content: "steer me",
        id: `user_${steeredKey}`,
        pendingRunId: "run-active",
        queueKind: "steered",
        status: "sent",
      }),
    ]);
  });

  test("uses hard steering for active-run sends when the setting selects interrupt mode", async () => {
    chat.startRun("run-active", "session-1");
    chatSteeringSettings.value = { steerByDefault: true, steeringMode: "hard" };
    gatewayResponses.set("sessions.steer", {
      interruptedActiveRun: true,
      runId: "hard-steer-run",
      status: "started",
    });

    const key = await sendMessage("session-1", "interrupt and steer");

    expect(gatewayCalls).toEqual([
      {
        method: "sessions.steer",
        params: {
          attachments: undefined,
          idempotencyKey: key,
          key: "session-1",
          message: "interrupt and steer",
          thinking: undefined,
          timeoutMs: undefined,
        },
      },
    ]);
    expect(chat.messageQueue.value).toEqual([]);
    expect(chat.messages.value[0]).toMatchObject({
      content: "interrupt and steer",
      status: "sent",
      steered: true,
    });
  });

  test("hard steering clears same-session queued follow-up messages", async () => {
    chat.startRun("run-active", "session-1");
    chatSteeringSettings.value = { steerByDefault: true, steeringMode: "hard" };
    gatewayResponses.set("sessions.steer", {
      interruptedActiveRun: true,
      runId: "hard-steer-run",
      status: "started",
    });
    chat.queueMessage(queuedMessage({ id: "user_same-session", content: "stale queued" }));
    chat.queueMessage(queuedMessage({ id: "user_other-session", sessionKey: "other" }));
    chat.queueMessage(
      queuedMessage({
        id: "user_pending-steer",
        queueKind: "steered",
        pendingRunId: "run-active",
      }),
    );

    await sendMessage("session-1", "interrupt and replace");

    expect(chat.messageQueue.value.map((message) => message.id)).toEqual([
      "user_other-session",
      "user_pending-steer",
    ]);
    await processNextQueuedMessage("session-1");
    expect(gatewayCalls.map((call) => call.method)).toEqual(["sessions.steer"]);
  });

  test("falls back to normal send for explicit /steer when no run is active", async () => {
    const key = await sendMessage("session-1", "/steer start normally");

    expect(gatewayCalls).toEqual([
      {
        method: "chat.send",
        params: {
          attachments: undefined,
          idempotencyKey: key,
          message: "start normally",
          sessionKey: "session-1",
          thinking: undefined,
          timeoutMs: undefined,
        },
      },
    ]);
    expect(chat.messages.value).toEqual([
      expect.objectContaining({
        content: "start normally",
        status: "sent",
        steered: false,
      }),
    ]);
    expect(chat.messageQueue.value).toEqual([]);
  });

  test("sends explicit /redirect commands through sessions.steer", async () => {
    gatewayResponses.set("sessions.steer", {
      interruptedActiveRun: true,
      runId: "redirected-run",
      status: "started",
    });
    chat.startRun("run-active", "session-1");

    const key = await sendMessage("session-1", "/redirect stop and do the other task");

    expect(gatewayCalls).toEqual([
      {
        method: "sessions.steer",
        params: {
          attachments: undefined,
          idempotencyKey: key,
          key: "session-1",
          message: "stop and do the other task",
          thinking: undefined,
          timeoutMs: undefined,
        },
      },
    ]);
    expect(chat.messages.value[0]).toMatchObject({
      content: "stop and do the other task",
      status: "sent",
      steered: true,
    });
  });

  test("hard-steers a queued message through sessions.steer", async () => {
    chat.startRun("run-active", "session-1");
    chatSteeringSettings.value = { steerByDefault: false, steeringMode: "hard" };
    gatewayResponses.set("sessions.steer", {
      interruptedActiveRun: true,
      runId: "hard-queued-run",
      status: "started",
    });
    chat.queueMessage(
      queuedMessage({
        id: "user_hard-queued-key",
        content: "queued hard steer",
        pendingAttachments: [attachment("image", "hard-queued.png")],
      }),
    );

    await steerQueuedMessage("user_hard-queued-key");

    expect(gatewayCalls).toEqual([
      {
        method: "sessions.steer",
        params: expect.objectContaining({
          attachments: [attachment("image", "hard-queued.png")],
          idempotencyKey: "hard-queued-key",
          key: "session-1",
          message: "queued hard steer",
        }),
      },
    ]);
    expect(chat.messageQueue.value).toEqual([]);
    expect(chat.messages.value).toEqual([
      expect.objectContaining({
        content: "queued hard steer",
        status: "sent",
        steered: true,
      }),
    ]);
  });

  test("converts a queued message into pending steering input", async () => {
    gatewayResponses.set("chat.send", { runId: "run-active", status: "started" });
    chat.startRun("run-active", "session-1");
    const attachments = [attachment("image", "queued-steer.png")];
    chat.queueMessage(
      queuedMessage({
        id: "user_queued-steer-key",
        content: "queued steer",
        pendingAttachments: attachments,
      }),
    );

    await steerQueuedMessage("user_queued-steer-key");

    expect(chat.messages.value).toEqual([]);
    expect(chat.messageQueue.value).toEqual([
      expect.objectContaining({
        content: "queued steer",
        pendingRunId: "run-active",
        queueKind: "steered",
        status: "sent",
      }),
    ]);
    expect(gatewayCalls).toEqual([
      {
        method: "chat.send",
        params: expect.objectContaining({
          attachments,
          deliver: false,
          idempotencyKey: "queued-steer-key",
          message: "queued steer",
          sessionKey: "session-1",
        }),
      },
    ]);
  });

  test("keeps queued steering pending when soft steering fails", async () => {
    gatewayResponses.set("chat.send", new Error("steer failed"));
    chat.startRun("run-active", "session-1");
    chat.queueMessage(
      queuedMessage({
        id: "user_queued-steer-fail",
        content: "still queued",
      }),
    );

    await expect(steerQueuedMessage("user_queued-steer-fail")).rejects.toThrow("steer failed");

    expect(chat.messageQueue.value).toEqual([
      expect.objectContaining({
        id: "user_queued-steer-fail",
        content: "still queued",
        queueKind: undefined,
        pendingRunId: undefined,
        status: "queued",
      }),
    ]);
    expect(chat.messages.value).toEqual([]);
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

  test("retry preserves failed soft steering intent", async () => {
    chat.startRun("run-active", "session-1");
    chat.messages.value = [
      queuedMessage({
        id: "user_steer-retry-key",
        content: "retry as steering",
        sessionKey: "session-1",
        status: "failed",
        steered: true,
      }),
    ];

    await retryMessage("user_steer-retry-key");

    expect(chat.messages.value[0]).toMatchObject({
      id: "user_steer-retry-key",
      status: "sent",
      steered: true,
    });
    expect(chat.messageQueue.value[0]).toMatchObject({
      id: "user_steer-retry-key",
      content: "retry as steering",
      pendingRunId: "run-active",
      queueKind: "steered",
      status: "sent",
    });
    expect(gatewayCalls[0]).toMatchObject({
      method: "chat.send",
      params: expect.objectContaining({
        deliver: false,
        idempotencyKey: "steer-retry-key",
        message: "retry as steering",
        sessionKey: "session-1",
      }),
    });
  });

  test("retry preserves failed queued soft steering intent", async () => {
    chat.startRun("run-active", "session-1");
    chat.queueMessage(
      queuedMessage({
        id: "user_queued-steer-retry-key",
        content: "retry queued steering",
        sessionKey: "session-1",
        status: "failed",
        steered: true,
        queueKind: "steered",
        pendingRunId: undefined,
      }),
    );

    await retryMessage("user_queued-steer-retry-key");

    expect(chat.messageQueue.value[0]).toMatchObject({
      id: "user_queued-steer-retry-key",
      content: "retry queued steering",
      pendingRunId: "run-active",
      queueKind: "steered",
      status: "sent",
      steered: true,
    });
    expect(gatewayCalls[0]).toMatchObject({
      method: "chat.send",
      params: expect.objectContaining({
        deliver: false,
        idempotencyKey: "queued-steer-retry-key",
        message: "retry queued steering",
        sessionKey: "session-1",
      }),
    });
  });

  test("marks /redirect failed when sessions.steer is unavailable", async () => {
    const unavailable = Object.assign(new Error("unknown method sessions.steer"), {
      code: "METHOD_NOT_FOUND",
    });
    gatewayResponses.set("sessions.steer", unavailable);
    chat.startRun("run-active", "session-1");

    await expect(sendMessage("session-1", "/redirect do this instead")).rejects.toThrow(
      "chat.steerUnavailable",
    );

    expect(chat.messages.value[0]).toMatchObject({
      content: "do this instead",
      error: "chat.steerUnavailable",
      status: "failed",
      steered: true,
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

  test("delays auto replay while startup history is loading or session has an active run", async () => {
    chat.queueMessage(
      queuedMessage({
        id: "user_wait-for-startup",
        sessionKey: "session-1",
        content: "wait for startup",
      }),
    );

    chat.isLoadingHistory.value = true;
    await processMessageQueue();

    expect(gatewayCalls).toEqual([]);
    expect(chat.messageQueue.value.map((message) => message.id)).toEqual(["user_wait-for-startup"]);

    chat.isLoadingHistory.value = false;
    chat.startRun("run-active", "session-1");
    await processMessageQueue();

    expect(gatewayCalls).toEqual([]);
    expect(chat.messageQueue.value.map((message) => message.id)).toEqual(["user_wait-for-startup"]);

    chat.activeRuns.value = new Map();
    await processMessageQueue();

    expect(gatewayCalls[0]).toMatchObject({
      method: "chat.send",
      params: expect.objectContaining({
        idempotencyKey: "wait-for-startup",
        message: "wait for startup",
        sessionKey: "session-1",
      }),
    });
    expect(chat.messageQueue.value).toEqual([]);
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

  test("/new reset is not soft-steered when steer by default is enabled", async () => {
    gatewayResponses.set("chat.send", { runId: "reset-run", status: "started" });
    chatSteeringSettings.value = { steerByDefault: true, steeringMode: "soft" };
    chat.startRun("run-active", "session-1");

    await sendMessage("session-1", "/new");

    expect(chat.messageQueue.value).toEqual([]);
    expect(gatewayCalls).toEqual([
      {
        method: "chat.send",
        params: {
          attachments: undefined,
          idempotencyKey: expect.any(String),
          message: "/new",
          sessionKey: "session-1",
          thinking: undefined,
          timeoutMs: undefined,
        },
      },
    ]);

    timers.advanceBy(100);
    await Promise.resolve();

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
