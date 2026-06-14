import type { GatewayRequest } from "../../src/types/gateway";
import type { ConnectParams } from "../../src/types/gateway-rpc";
import {
  connectChallengeFrame,
  errorResponseFrame,
  eventFrame,
  helloOkFrame,
  responseFrame,
} from "../fixtures/gateway";
import { installMockWebSocket, type MockWebSocket } from "./websocket";

type MockGatewayResult = unknown | ((request: GatewayRequest) => unknown | Promise<unknown>);
const REQUIRED_OPERATOR_SCOPES = ["operator.admin", "operator.read", "operator.write"] as const;

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
        const connectError = validateConnectRequest(request.params);
        if (connectError) {
          socket.receive(
            errorResponseFrame(request.id, {
              code: "INVALID_CONNECT",
              message: connectError,
            }),
          );
          return;
        }
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

function validateConnectRequest(params: unknown): string | null {
  if (!params || typeof params !== "object") return "connect params are required";
  const connect = params as Partial<ConnectParams>;
  if (connect.minProtocol !== 4 || connect.maxProtocol !== 4) {
    return "connect protocol must be v4";
  }
  if (connect.client?.id !== "openclaw-control-ui") {
    return "connect client id must be openclaw-control-ui";
  }
  if (connect.client?.mode !== "ui") {
    return "connect client mode must be ui";
  }
  if (connect.role !== "operator") {
    return "connect role must be operator";
  }
  for (const scope of REQUIRED_OPERATOR_SCOPES) {
    if (!connect.scopes?.includes(scope)) {
      return `connect scopes must include ${scope}`;
    }
  }
  if (!connect.caps?.includes("tool-events")) {
    return "connect caps must include tool-events";
  }
  const authModes = [connect.auth?.token, connect.auth?.password].filter(Boolean);
  if (authModes.length !== 1) {
    return "connect auth must include exactly one of token or password";
  }
  return null;
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
