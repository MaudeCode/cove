import { afterEach, describe, expect, test } from "bun:test";
import { connect, disconnect } from "../../../src/lib/gateway";
import {
  connectChallengeFrame,
  errorResponseFrame,
  helloOkFrame,
  responseFrame,
} from "../../fixtures/gateway";
import { installMockWebSocket } from "../../mocks/websocket";

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
