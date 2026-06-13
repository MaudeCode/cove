import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { installFakeTimers, type FakeTimers } from "../../helpers/timers";

const sockets: FakeWebSocket[] = [];

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly CONNECTING = FakeWebSocket.CONNECTING;
  readonly OPEN = FakeWebSocket.OPEN;
  readonly CLOSING = FakeWebSocket.CLOSING;
  readonly CLOSED = FakeWebSocket.CLOSED;

  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onopen: (() => void) | null = null;
  readyState = FakeWebSocket.CONNECTING;
  readonly url: string;

  constructor(url: string) {
    this.url = url;
    sockets.push(this);
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.({ code: 1000, reason: "closed" } as CloseEvent);
  }

  send() {}
}

mock.module("@/lib/storage", () => ({
  getAuth: () => ({ url: "wss://gateway.example.test", authMode: "token", rememberMe: true }),
  getSessionCredential: () => "token",
}));

mock.module("@/lib/logger", () => ({
  log: {
    node: {
      debug: () => undefined,
      error: () => undefined,
    },
  },
}));

const originalWebSocket = globalThis.WebSocket;
let timers: FakeTimers;

const { gatewayUrl } = await import("../../../src/lib/gateway");
const { refreshNodeRegistration, startNodeConnection, stopNodeConnection } =
  await import("../../../src/lib/node-connection");

describe("node connection", () => {
  beforeEach(() => {
    sockets.length = 0;
    gatewayUrl.value = "wss://gateway.example.test";
    timers = installFakeTimers();
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
    stopNodeConnection();
  });

  afterEach(() => {
    stopNodeConnection();
    timers.uninstall();
    globalThis.WebSocket = originalWebSocket;
  });

  test("stopNodeConnection cancels a pending refresh reconnect", () => {
    startNodeConnection();
    expect(sockets).toHaveLength(1);

    refreshNodeRegistration();
    stopNodeConnection();
    timers.advanceBy(600);

    expect(sockets).toHaveLength(1);
    expect(sockets[0]?.readyState).toBe(FakeWebSocket.CLOSED);
  });

  test("refreshNodeRegistration replaces a pending close reconnect", () => {
    startNodeConnection();
    expect(sockets).toHaveLength(1);

    sockets[0]?.close();
    refreshNodeRegistration();
    timers.advanceBy(600);
    timers.advanceBy(5_000);

    expect(sockets).toHaveLength(2);
    expect(sockets[0]?.readyState).toBe(FakeWebSocket.CLOSED);
  });
});
