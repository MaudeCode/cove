import { afterEach, describe, expect, test } from "bun:test";
import { connect, disconnect, type ConnectConfig } from "../../../src/lib/gateway";
import type { GatewayRequest } from "../../../src/types/gateway";
import type { ConnectParams } from "../../../src/types/gateway-rpc";
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

function openGatewayConnection(config: Omit<ConnectConfig, "autoReconnect" | "url">) {
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

function receiveConnectRequest(
  socket: ReturnType<typeof installMockWebSocket>["instances"][number],
) {
  socket.receive(connectChallengeFrame());
  const requests = socket.sentJson() as GatewayRequest[];
  expect(requests).toHaveLength(1);
  return requests[0] as ConnectRequest;
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
      socket.receive(connectChallengeFrame());

      expect(socket.sentJson()).toEqual([
        {
          type: "req",
          id: "req_1",
          method: "connect",
          params: expect.objectContaining({
            minProtocol: 4,
            maxProtocol: 4,
            auth: { token: "test-token" },
          }),
        },
      ]);

      socket.receive(responseFrame("req_1", helloOkFrame({ server: { version: "test-gateway" } })));

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
});
