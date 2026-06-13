import { beforeEach, describe, expect, mock, test } from "bun:test";
import { signal } from "@preact/signals";
import { createGatewayMock, createSessionSignalsMock } from "../../helpers/module-mocks";

const storage = await import("../../../src/lib/storage");

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
  initChat: async () => undefined,
}));

mock.module("@/signals/sessions", () => ({
  ...createSessionSignalsMock(),
  cleanupSessionEventSubscription: () => {
    calls.cleanupSessionEventSubscription++;
  },
  clearSessions: () => {
    calls.clearSessions++;
  },
}));

mock.module("@/lib/gateway", () => ({
  ...createGatewayMock({
    disconnect: () => {
      calls.disconnect++;
    },
    isConnected: { value: true },
    mainSessionKey: { value: "main" },
    send: () => {
      throw new Error("send is not used by logout tests");
    },
  }),
  disconnect: () => {
    calls.disconnect++;
  },
  send: () => {
    throw new Error("send is not used by logout tests");
  },
}));

mock.module("@/lib/node-connection", () => ({
  canvasBlobUrl: signal<string | null>(null),
  canvasContent: signal<string | null>(null),
  canvasContentType: signal<string | null>(null),
  canvasUrl: signal<string | null>(null),
  canvasVisible: signal(false),
  nodeConnected: signal(false),
  nodePairingStatus: signal("unpaired"),
  pendingCanvasEval: signal(null),
  pendingCanvasSnapshot: signal(null),
  standaloneCanvasOpen: signal(false),
  startNodeConnection: () => undefined,
  stopNodeConnection: () => {
    calls.stopNodeConnection++;
  },
}));

mock.module("@/lib/storage", () => ({
  ...storage,
  clearAuth: () => {
    calls.clearAuth++;
  },
  completeOnboarding: () => undefined,
  saveAuth: () => undefined,
  setPendingTour: () => undefined,
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
