import type { GatewayRequest } from "../../src/types/gateway";
import {
  connectChallengeFrame,
  errorResponseFrame,
  eventFrame,
  helloOkFrame,
  responseFrame,
} from "../fixtures/gateway";
import { installMockWebSocket, type MockWebSocket } from "./websocket";

type MockGatewayResult = unknown | ((request: GatewayRequest) => unknown | Promise<unknown>);

export interface MockGatewayRuntimeOptions {
  hello?: Parameters<typeof helloOkFrame>[0];
  results?: Record<string, MockGatewayResult>;
}

export interface MockGatewayRuntime {
  acceptConnection: () => Promise<MockWebSocket>;
  emit: (event: string, payload?: unknown) => void;
  requests: () => GatewayRequest[];
  setResult: (method: string, result: MockGatewayResult) => void;
  socket: () => MockWebSocket;
  uninstall: () => void;
}

export function installMockGatewayRuntime(
  options: MockGatewayRuntimeOptions = {},
): MockGatewayRuntime {
  const sockets = installMockWebSocket();
  const requests: GatewayRequest[] = [];
  const results = new Map<string, MockGatewayResult>([
    ["chat.history", { sessionKey: "agent:main:main", messages: [] }],
    ["health", defaultHealth()],
    ["sessions.list", { count: 1, sessions: [{ key: "agent:main:main", label: "Main" }] }],
    ["status", { ok: true }],
    ...Object.entries(options.results ?? {}),
  ]);
  let activeSocket: MockWebSocket | null = null;
  let unsubscribeSend: (() => void) | null = null;

  const attach = (socket: MockWebSocket) => {
    if (activeSocket === socket) return;
    unsubscribeSend?.();
    activeSocket = socket;
    unsubscribeSend = socket.onSend((data) => {
      void handleRequest(socket, data);
    });
  };

  return {
    async acceptConnection() {
      const socket = sockets.latest();
      attach(socket);
      socket.open();
      socket.receive(connectChallengeFrame());
      await Promise.resolve();
      return socket;
    },
    emit(event: string, payload?: unknown) {
      getActiveSocket(activeSocket).receive(eventFrame(event, payload));
    },
    requests() {
      return [...requests];
    },
    setResult(method: string, result: MockGatewayResult) {
      results.set(method, result);
    },
    socket() {
      return getActiveSocket(activeSocket);
    },
    uninstall() {
      unsubscribeSend?.();
      sockets.uninstall();
      activeSocket = null;
    },
  };

  async function handleRequest(socket: MockWebSocket, data: string): Promise<void> {
    const request = JSON.parse(data) as GatewayRequest;
    requests.push(request);

    try {
      if (request.method === "connect") {
        socket.receive(responseFrame(request.id, helloOkFrame(options.hello)));
        return;
      }

      if (!results.has(request.method)) {
        socket.receive(
          errorResponseFrame(request.id, {
            code: "METHOD_NOT_FOUND",
            message: `No mock result for ${request.method}`,
          }),
        );
        return;
      }

      const result = results.get(request.method);
      const payload = typeof result === "function" ? await result(request) : result;
      socket.receive(responseFrame(request.id, payload));
    } catch (err) {
      socket.receive(
        errorResponseFrame(request.id, {
          code: "MOCK_RUNTIME_ERROR",
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}

function getActiveSocket(socket: MockWebSocket | null): MockWebSocket {
  if (!socket) throw new Error("Mock gateway runtime has no active socket");
  return socket;
}

function defaultHealth() {
  return {
    ok: true,
    ts: 1,
    durationMs: 0,
    heartbeatSeconds: 30,
    defaultAgentId: "main",
    agents: [],
    sessions: {
      path: "/tmp/cove-test-sessions",
      count: 1,
      recent: [{ key: "agent:main:main", updatedAt: null, age: null }],
    },
    channels: {},
    channelOrder: [],
    channelLabels: {},
  };
}
