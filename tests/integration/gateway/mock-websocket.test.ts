import { afterEach, describe, expect, test } from "bun:test";
import {
  connect,
  connectionState,
  disconnect,
  GatewayRpcError,
  on,
  reconnectAttempt,
  sendUnknown,
  subscribe,
  type ConnectConfig,
} from "../../../src/lib/gateway";
import { log } from "../../../src/lib/logger";
import type { GatewayRequest } from "../../../src/types/gateway";
import type { ConnectParams } from "../../../src/types/gateway-rpc";
import { installFakeTimers } from "../../helpers/timers";
import {
  connectChallengeFrame,
  errorResponseFrame,
  eventFrame,
  helloOkFrame,
  responseFrame,
} from "../../fixtures/gateway";
import { installMockWebSocket } from "../../mocks/websocket";

type ConnectRequest = GatewayRequest & {
  method: "connect";
  params: ConnectParams;
};

function openGatewayConnection(config: Omit<ConnectConfig, "url">) {
  const sockets = installMockWebSocket();
  const helloPromise = connect({
    url: "ws://gateway.test",
    autoReconnect: false,
    ...config,
  });
  const socket = sockets.latest();
  socket.open();

  return { helloPromise, socket, sockets };
}

async function connectOpenGateway(config: Omit<ConnectConfig, "url"> = {}) {
  const { helloPromise, socket, sockets } = openGatewayConnection({
    autoReconnect: false,
    token: "test-token",
    ...config,
  });
  const connectRequest = receiveConnectRequest(socket);
  socket.receive(responseFrame(connectRequest.id, helloOkFrame()));
  await helloPromise;
  const requestBaseline = sentGatewayRequests(socket).length;

  return {
    requestsAfterConnect() {
      return sentGatewayRequests(socket).slice(requestBaseline);
    },
    socket,
    sockets,
  };
}

function receiveConnectRequest(
  socket: ReturnType<typeof installMockWebSocket>["instances"][number],
) {
  socket.receive(connectChallengeFrame());
  const requests = socket.sentJson() as GatewayRequest[];
  expect(requests).toHaveLength(1);
  return requests[0] as ConnectRequest;
}

function sentGatewayRequests(socket: ReturnType<typeof installMockWebSocket>["instances"][number]) {
  return socket.sentJson() as GatewayRequest[];
}

async function flushGatewayPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function captureGatewayWarnings(): { messages: unknown[][]; restore: () => void } {
  const originalWarn = log.gateway.warn;
  const messages: unknown[][] = [];
  log.gateway.warn = (...args: unknown[]) => {
    messages.push(args);
  };

  return {
    messages,
    restore() {
      log.gateway.warn = originalWarn;
    },
  };
}

function mockUserAgent(userAgent: string): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis.navigator, "userAgent");
  Object.defineProperty(globalThis.navigator, "userAgent", {
    configurable: true,
    value: userAgent,
  });

  return () => {
    if (descriptor) {
      Object.defineProperty(globalThis.navigator, "userAgent", descriptor);
    } else {
      Reflect.deleteProperty(globalThis.navigator, "userAgent");
    }
  };
}

describe("gateway mock websocket harness", () => {
  afterEach(() => {
    disconnect();
  });

  test("drives the gateway connect handshake without a real server", async () => {
    const sockets = installMockWebSocket();

    try {
      const helloPromise = connect({
        url: "ws://gateway.test",
        token: "test-token",
        autoReconnect: false,
      });

      const socket = sockets.latest();
      socket.open();

      const connectRequest = receiveConnectRequest(socket);
      expect(connectRequest.type).toBe("req");
      expect(connectRequest.id).toMatch(/^req_\d+$/);
      expect(connectRequest.method).toBe("connect");
      expect(connectRequest.params).toEqual(
        expect.objectContaining({
          minProtocol: 4,
          maxProtocol: 4,
          auth: { token: "test-token" },
        }),
      );

      socket.receive(
        responseFrame(connectRequest.id, helloOkFrame({ server: { version: "test-gateway" } })),
      );

      await expect(helloPromise).resolves.toMatchObject({
        server: { version: "test-gateway" },
      });
    } finally {
      sockets.uninstall();
    }
  });

  test("sends the full v4 control-ui connect contract only after challenge", async () => {
    const restoreUserAgent = mockUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
    );
    const { helloPromise, socket, sockets } = openGatewayConnection({ token: "test-token" });

    try {
      expect(socket.sentJson()).toEqual([]);

      socket.receive(eventFrame("presence.update", { clients: [] }));
      expect(socket.sentJson()).toEqual([]);

      const connectRequest = receiveConnectRequest(socket);
      expect(connectRequest).toEqual({
        type: "req",
        id: expect.stringMatching(/^req_\d+$/),
        method: "connect",
        params: {
          minProtocol: 4,
          maxProtocol: 4,
          client: {
            id: "openclaw-control-ui",
            displayName: "Cove",
            version: "test",
            platform: "macos",
            mode: "ui",
          },
          caps: ["tool-events"],
          role: "operator",
          scopes: ["operator.admin", "operator.read", "operator.write"],
          auth: { token: "test-token" },
        },
      });
      expect(connectRequest.params.minProtocol).toBe(connectRequest.params.maxProtocol);
      expect(connectRequest.params.client.id).toBe("openclaw-control-ui");
      expect(connectRequest.params.client.mode).toBe("ui");
      expect(connectRequest.params.role).toBe("operator");
      expect(connectRequest.params.caps).toContain("tool-events");

      socket.receive(responseFrame(connectRequest.id, helloOkFrame()));

      await expect(helloPromise).resolves.toMatchObject({ type: "hello-ok" });
    } finally {
      restoreUserAgent();
      sockets.uninstall();
    }
  });

  test("uses password auth only when no token is provided", async () => {
    const { helloPromise, socket, sockets } = openGatewayConnection({
      password: "test-password",
    });

    try {
      const connectRequest = receiveConnectRequest(socket);
      expect(connectRequest.params?.auth).toEqual({ password: "test-password" });

      socket.receive(responseFrame(connectRequest.id, helloOkFrame()));

      await expect(helloPromise).resolves.toMatchObject({ type: "hello-ok" });
    } finally {
      sockets.uninstall();
    }
  });

  test("prefers token auth when both token and password are present", async () => {
    const { helloPromise, socket, sockets } = openGatewayConnection({
      token: "test-token",
      password: "test-password",
    });

    try {
      const connectRequest = receiveConnectRequest(socket);
      expect(connectRequest.params?.auth).toEqual({ token: "test-token" });

      socket.receive(responseFrame(connectRequest.id, helloOkFrame()));

      await expect(helloPromise).resolves.toMatchObject({ type: "hello-ok" });
    } finally {
      sockets.uninstall();
    }
  });

  test("accepts legacy evt connect challenges", async () => {
    const { helloPromise, socket, sockets } = openGatewayConnection({ token: "test-token" });

    try {
      socket.receive({
        ...connectChallengeFrame(),
        type: "evt",
      });

      const requests = socket.sentJson() as ConnectRequest[];
      expect(requests).toHaveLength(1);
      const [connectRequest] = requests;
      socket.receive(responseFrame(connectRequest.id, helloOkFrame()));

      await expect(helloPromise).resolves.toMatchObject({ type: "hello-ok" });
    } finally {
      sockets.uninstall();
    }
  });

  test("drives gateway handshake error responses", async () => {
    const sockets = installMockWebSocket();

    try {
      const helloPromise = connect({
        url: "ws://gateway.test",
        token: "bad-token",
        autoReconnect: false,
      });

      const socket = sockets.latest();
      socket.open();
      socket.receive(connectChallengeFrame());

      const [connectRequest] = socket.sentJson() as Array<{ id: string }>;
      socket.receive(
        errorResponseFrame(connectRequest.id, {
          code: "AUTH_FAILED",
          message: "Authentication failed",
        }),
      );

      await expect(helloPromise).rejects.toThrow("Authentication failed");
    } finally {
      sockets.uninstall();
    }
  });

  test("preserves structured gateway error fields on failed responses", async () => {
    const { requestsAfterConnect, socket, sockets } = await connectOpenGateway();

    try {
      const resultPromise = sendUnknown("structured.error");
      const [request] = requestsAfterConnect();

      socket.receive(
        errorResponseFrame(request.id, {
          code: "RATE_LIMITED",
          message: "Slow down",
          details: { limit: 10, windowMs: 1000 },
          retryable: true,
          retryAfterMs: 2500,
        }),
      );

      const error = await resultPromise.catch((err: unknown) => err);

      expect(error).toBeInstanceOf(GatewayRpcError);
      expect(error).toMatchObject({
        name: "GatewayRpcError",
        message: "Slow down",
        code: "RATE_LIMITED",
        details: { limit: 10, windowMs: 1000 },
        retryable: true,
        retryAfterMs: 2500,
      });
      expect(Object.keys(error as object)).not.toContain("details");
    } finally {
      sockets.uninstall();
    }
  });

  test("preserves request-failed fallback for malformed gateway error objects", async () => {
    const { requestsAfterConnect, socket, sockets } = await connectOpenGateway();

    try {
      const resultPromise = sendUnknown("malformed.error");
      const [request] = requestsAfterConnect();

      socket.receive({
        type: "res",
        id: request.id,
        ok: false,
        error: { code: "MALFORMED" } as never,
      });

      await expect(resultPromise).rejects.toMatchObject({
        name: "GatewayRpcError",
        message: "Request failed",
        code: "MALFORMED",
      });
      await expect(resultPromise).rejects.toBeInstanceOf(GatewayRpcError);
    } finally {
      sockets.uninstall();
    }
  });

  test("uses a plain fallback error when a failed response has no error payload", async () => {
    const { requestsAfterConnect, socket, sockets } = await connectOpenGateway();

    try {
      const resultPromise = sendUnknown("missing.error");
      const [request] = requestsAfterConnect();

      socket.receive({
        type: "res",
        id: request.id,
        ok: false,
      });

      await expect(resultPromise).rejects.toThrow("Request failed");
      await expect(resultPromise).rejects.not.toBeInstanceOf(GatewayRpcError);
    } finally {
      sockets.uninstall();
    }
  });

  test("matches responses to request ids when responses arrive out of order", async () => {
    const { requestsAfterConnect, socket, sockets } = await connectOpenGateway();

    try {
      const firstPromise = sendUnknown("first.method");
      const secondPromise = sendUnknown("second.method");
      const [firstRequest, secondRequest] = requestsAfterConnect();

      socket.receive(responseFrame(secondRequest.id, { value: "second" }));
      socket.receive(responseFrame(firstRequest.id, { value: "first" }));

      await expect(firstPromise).resolves.toEqual({ value: "first" });
      await expect(secondPromise).resolves.toEqual({ value: "second" });
    } finally {
      sockets.uninstall();
    }
  });

  test("ignores responses for unknown request ids", async () => {
    const { requestsAfterConnect, socket, sockets } = await connectOpenGateway();

    try {
      const pendingPromise = sendUnknown("known.method");
      const [request] = requestsAfterConnect();

      socket.receive(responseFrame("req_missing", { value: "wrong" }));
      socket.receive(responseFrame(request.id, { value: "right" }));

      await expect(pendingPromise).resolves.toEqual({ value: "right" });
    } finally {
      sockets.uninstall();
    }
  });

  test("cleans timed-out requests and ignores their late responses", async () => {
    const timers = installFakeTimers();
    const warnings = captureGatewayWarnings();
    const { requestsAfterConnect, socket, sockets } = await connectOpenGateway();

    try {
      const slowPromise = sendUnknown("slow.method", undefined, { timeout: 50 });
      const [slowRequest] = requestsAfterConnect();

      timers.advanceBy(50);

      await expect(slowPromise).rejects.toThrow("Request timeout: slow.method");

      socket.receive(responseFrame(slowRequest.id, { value: "too-late" }));

      const nextPromise = sendUnknown("next.method");
      const nextRequest = requestsAfterConnect().at(-1);
      expect(nextRequest?.method).toBe("next.method");
      socket.receive(responseFrame(nextRequest?.id ?? "", { value: "next" }));

      await expect(nextPromise).resolves.toEqual({ value: "next" });
      expect(warnings.messages).toEqual([
        [" Received response for unknown request:", slowRequest.id],
      ]);
    } finally {
      warnings.restore();
      timers.uninstall();
      sockets.uninstall();
    }
  });

  test("rejects pending requests when disconnect is called", async () => {
    const { sockets } = await connectOpenGateway();

    try {
      const pendingPromise = sendUnknown("pending.method");

      disconnect();

      await expect(pendingPromise).rejects.toThrow("Disconnected");
      expect(connectionState.value).toBe("disconnected");
    } finally {
      sockets.uninstall();
    }
  });

  test("disconnect cancels auto-reconnect", async () => {
    const timers = installFakeTimers();
    const { socket, sockets } = await connectOpenGateway({ autoReconnect: true });

    try {
      disconnect();
      timers.advanceBy(60_000);

      expect(connectionState.value).toBe("disconnected");
      expect(reconnectAttempt.value).toBe(0);
      expect(socket.readyState).toBe(socket.CLOSED);
      expect(sockets.instances).toHaveLength(1);
    } finally {
      timers.uninstall();
      sockets.uninstall();
    }
  });

  test("rejects pending requests when the server closes the socket", async () => {
    const { socket, sockets } = await connectOpenGateway();

    try {
      const pendingPromise = sendUnknown("pending.method");

      socket.serverClose();

      await expect(pendingPromise).rejects.toThrow("Connection closed");
      expect(connectionState.value).toBe("disconnected");
    } finally {
      sockets.uninstall();
    }
  });

  test("rejects pending requests and starts reconnect after a connected socket closes", async () => {
    const timers = installFakeTimers();
    const { socket, sockets } = await connectOpenGateway({ autoReconnect: true });

    try {
      const pendingPromise = sendUnknown("pending.method");

      socket.serverClose();

      await expect(pendingPromise).rejects.toThrow("Connection closed");
      expect(connectionState.value).toBe("reconnecting");
      expect(reconnectAttempt.value).toBe(1);
    } finally {
      timers.uninstall();
      sockets.uninstall();
    }
  });

  test("reconnects after a connected socket closes", async () => {
    const timers = installFakeTimers();
    const { socket, sockets } = await connectOpenGateway({ autoReconnect: true });

    try {
      socket.serverClose();

      expect(connectionState.value).toBe("reconnecting");
      expect(reconnectAttempt.value).toBe(1);

      timers.advanceBy(1000);

      const reconnectSocket = sockets.latest();
      expect(sockets.instances).toHaveLength(2);
      reconnectSocket.open();
      const connectRequest = receiveConnectRequest(reconnectSocket);
      expect(connectRequest).toMatchObject({
        method: "connect",
        params: {
          minProtocol: 4,
          maxProtocol: 4,
          auth: { token: "test-token" },
        },
      });
      reconnectSocket.receive(responseFrame(connectRequest.id, helloOkFrame()));

      await flushGatewayPromises();

      expect(connectionState.value).toBe("connected");
    } finally {
      timers.uninstall();
      sockets.uninstall();
    }
  });

  test("sends heartbeat health checks while connected", async () => {
    const timers = installFakeTimers();
    const { socket, sockets } = await connectOpenGateway();

    try {
      timers.advanceBy(30_000);

      const healthRequest = sentGatewayRequests(socket).at(-1);
      expect(healthRequest?.method).toBe("health");

      socket.receive(responseFrame(healthRequest?.id ?? "", { ok: true }));
    } finally {
      timers.uninstall();
      sockets.uninstall();
    }
  });

  test("delivers events to subscribers and removes unsubscribed handlers", async () => {
    const { socket, sockets } = await connectOpenGateway();
    const allEvents: string[] = [];
    const statusPayloads: unknown[] = [];
    const unsubscribeAll = subscribe((event) => allEvents.push(event.event));
    const unsubscribeStatus = on("status.update", (payload) => statusPayloads.push(payload));

    try {
      socket.receive(eventFrame("status.update", { ok: true }));
      unsubscribeStatus();
      socket.receive(eventFrame("status.update", { ok: false }));
      unsubscribeAll();
      socket.receive(eventFrame("status.update", { ok: "ignored" }));

      expect(allEvents).toEqual(["status.update", "status.update"]);
      expect(statusPayloads).toEqual([{ ok: true }]);
    } finally {
      unsubscribeAll();
      unsubscribeStatus();
      sockets.uninstall();
    }
  });
});
