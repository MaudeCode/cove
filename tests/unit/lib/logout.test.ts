import { beforeEach, describe, expect, mock, test } from "bun:test";
import { signal } from "@preact/signals";

const calls = {
  cleanupChat: 0,
  cleanupSessionEventSubscription: 0,
  clearSessions: 0,
  clearAuth: 0,
  disconnect: 0,
  stopNodeConnection: 0,
  routes: [] as string[],
};

mock.module("@/lib/chat/init", () => ({
  cleanupChat: () => {
    calls.cleanupChat++;
  },
}));

mock.module("@/signals/sessions", () => ({
  cleanupSessionEventSubscription: () => {
    calls.cleanupSessionEventSubscription++;
  },
  clearSessions: () => {
    calls.clearSessions++;
  },
}));

mock.module("@/lib/gateway", () => ({
  disconnect: () => {
    calls.disconnect++;
  },
  isConnected: { value: true },
  mainSessionKey: { value: "main" },
  on: () => () => undefined,
  send: () => {
    throw new Error("send is not used by logout tests");
  },
  subscribe: () => () => undefined,
}));

mock.module("@/lib/node-connection", () => ({
  canvasBlobUrl: signal<string | null>(null),
  canvasContent: signal<string | null>(null),
  canvasContentType: signal<string | null>(null),
  canvasUrl: signal<string | null>(null),
  canvasVisible: signal(false),
  pendingCanvasEval: signal(null),
  pendingCanvasSnapshot: signal(null),
  standaloneCanvasOpen: signal(false),
  stopNodeConnection: () => {
    calls.stopNodeConnection++;
  },
}));

mock.module("@/lib/storage", () => ({
  clearAuth: () => {
    calls.clearAuth++;
  },
}));

mock.module("preact-router", () => ({
  route: (path: string) => {
    calls.routes.push(path);
  },
}));

const { logout } = await import("../../../src/lib/logout");

describe("logout cleanup", () => {
  beforeEach(() => {
    calls.cleanupChat = 0;
    calls.cleanupSessionEventSubscription = 0;
    calls.clearSessions = 0;
    calls.clearAuth = 0;
    calls.disconnect = 0;
    calls.stopNodeConnection = 0;
    calls.routes = [];
  });

  test("cleans app state, clears credentials, disconnects, and routes home", () => {
    logout();

    expect(calls).toEqual({
      cleanupChat: 1,
      cleanupSessionEventSubscription: 1,
      clearSessions: 1,
      clearAuth: 1,
      disconnect: 1,
      stopNodeConnection: 1,
      routes: ["/"],
    });
  });

  test("can keep credentials while still disconnecting and routing home", () => {
    logout(false);

    expect(calls).toEqual({
      cleanupChat: 1,
      cleanupSessionEventSubscription: 1,
      clearSessions: 1,
      clearAuth: 0,
      disconnect: 1,
      stopNodeConnection: 1,
      routes: ["/"],
    });
  });
});
