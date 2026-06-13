import { afterEach, describe, expect, test } from "bun:test";
import {
  connect,
  disconnect,
  GatewayRpcError,
  on,
  send,
  sendUnknown,
} from "../../../src/lib/gateway";
import { installMockGatewayRuntime } from "../../mocks/gateway-runtime";

let runtime: ReturnType<typeof installMockGatewayRuntime> | null = null;

describe("mock gateway runtime", () => {
  afterEach(() => {
    disconnect();
    runtime?.uninstall();
    runtime = null;
  });

  test("connects and responds to common app RPCs without a live gateway", async () => {
    runtime = installMockGatewayRuntime();

    const helloPromise = connect({
      url: "ws://gateway.test",
      token: "test-token",
      autoReconnect: false,
    });

    await runtime.acceptConnection();

    await expect(helloPromise).resolves.toMatchObject({
      type: "hello-ok",
      snapshot: {
        sessionDefaults: {
          mainSessionKey: "agent:main:main",
        },
      },
    });

    await expect(send("sessions.list", { limit: 5 })).resolves.toEqual({
      count: 1,
      sessions: [{ key: "agent:main:main", label: "Main" }],
    });
    await expect(
      send("chat.history", { sessionKey: "agent:main:main", limit: 10 }),
    ).resolves.toEqual({
      sessionKey: "agent:main:main",
      messages: [],
    });
    await expect(send("health", { probe: true })).resolves.toMatchObject({ ok: true });
    await expect(sendUnknown("status")).resolves.toMatchObject({ ok: true });

    expect(runtime.requests().map((request) => request.method)).toEqual([
      "connect",
      "sessions.list",
      "chat.history",
      "health",
      "status",
    ]);
  });

  test("emits streamed gateway events", async () => {
    runtime = installMockGatewayRuntime();
    const received: unknown[] = [];
    const unsubscribe = on("chat.event", (payload) => received.push(payload));

    try {
      const helloPromise = connect({
        url: "ws://gateway.test",
        token: "test-token",
        autoReconnect: false,
      });
      await runtime.acceptConnection();
      await helloPromise;

      runtime.emit("chat.event", {
        runId: "run_1",
        sessionKey: "agent:main:main",
        seq: 1,
        state: "delta",
        deltaText: "hello",
      });

      expect(received).toEqual([
        {
          runId: "run_1",
          sessionKey: "agent:main:main",
          seq: 1,
          state: "delta",
          deltaText: "hello",
        },
      ]);
    } finally {
      unsubscribe();
    }
  });

  test("surfaces mock runtime gateway errors from sendUnknown", async () => {
    runtime = installMockGatewayRuntime();

    const helloPromise = connect({
      url: "ws://gateway.test",
      token: "test-token",
      autoReconnect: false,
    });

    await runtime.acceptConnection();
    await helloPromise;

    const resultPromise = sendUnknown("missing.runtime.method");

    await expect(resultPromise).rejects.toMatchObject({
      name: "GatewayRpcError",
      message: "No mock result for missing.runtime.method",
      code: "METHOD_NOT_FOUND",
    });
    await expect(resultPromise).rejects.toBeInstanceOf(GatewayRpcError);
  });
});
