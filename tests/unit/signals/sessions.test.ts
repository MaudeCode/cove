import { beforeEach, describe, expect, mock, test } from "bun:test";
import { signal } from "@preact/signals";
import { createGatewayMock } from "../../helpers/module-mocks";
import { installFakeTimers } from "../../helpers/timers";
import type { Session } from "../../../src/types/sessions";

type NamedGatewayHandler = (payload: unknown) => void;

const gatewayCalls: Array<{ method: string; params: unknown }> = [];
const gatewayHandlers = new Map<string, Set<NamedGatewayHandler>>();
const isConnected = signal(true);
let cachedSessions: Session[] | null = null;
let sendResponder: (method: string, params?: unknown) => unknown = () => ({ ok: true });

mock.module("@/lib/gateway", () =>
  createGatewayMock({
    isConnected,
    on: (...args: unknown[]) => {
      const [event, handler] = args as [string, NamedGatewayHandler];
      const handlers = gatewayHandlers.get(event) ?? new Set<NamedGatewayHandler>();
      handlers.add(handler);
      gatewayHandlers.set(event, handlers);
      return () => {
        handlers.delete(handler);
        if (handlers.size === 0) {
          gatewayHandlers.delete(event);
        }
      };
    },
    send: async (method: string, params?: unknown) => {
      gatewayCalls.push({ method, params });
      return sendResponder(method, params);
    },
  }),
);

mock.module("@/lib/session-utils", () => ({
  groupSessionsByTime: (sessions: Session[]) => ({ Today: sessions }),
  isChannelSession: (item: Session) => Boolean(item.channel) || item.kind === "channel",
  isCronSession: (item: Session) => item.key.includes(":cron:"),
  isMainSession: (key: string) => key === "agent:main:main",
  isSpawnSession: (item: Session) => item.key.includes(":spawn:"),
}));

mock.module("@/lib/debounced-signal", () => ({
  createDebouncedSignal: <T>(source: { value: T }) => source,
}));

mock.module("@/lib/constants", () => ({
  SESSION_DELETE_ANIMATION_MS: 300,
}));

mock.module("@/lib/storage", () => ({
  getModelFavorites: () => new Set<string>(),
  getSessionsCache: () => cachedSessions,
  setModelFavorites: () => undefined,
  setSessionsCache: (sessions: Session[]) => {
    cachedSessions = sessions;
  },
}));

mock.module("@/lib/logger", () => ({
  log: {
    ui: {
      warn: () => undefined,
    },
  },
}));

const sessionSignals = await import("../../../src/signals/sessions");

function session(overrides: Partial<Session> = {}): Session {
  return {
    key: "agent:main:chat:alpha",
    kind: "isolated",
    label: "Alpha",
    updatedAt: 100,
    ...overrides,
  };
}

function emitGatewayEvent(event: string, payload: unknown): void {
  for (const handler of gatewayHandlers.get(event) ?? []) {
    handler(payload);
  }
}

function resetState(): void {
  sessionSignals.cleanupSessionEventSubscription();
  sessionSignals.sessions.value = [];
  sessionSignals.activeSessionKey.value = null;
  sessionSignals.sessionKindFilter.value = null;
  sessionSignals.sessionSearchQuery.value = "";
  sessionSignals.deletingSessionKey.value = null;
  gatewayCalls.length = 0;
  gatewayHandlers.clear();
  cachedSessions = null;
  isConnected.value = true;
  sendResponder = () => ({ ok: true });
}

describe("session signals", () => {
  beforeEach(() => {
    resetState();
  });

  test("applies sessions.changed updates to in-memory and persisted cache", () => {
    const initial = session({ label: "Alpha", model: "anthropic/claude-opus-4-5" });
    sessionSignals.sessions.value = [initial];
    sessionSignals.setActiveSession(initial.key);

    sessionSignals.initSessionEventSubscription();
    emitGatewayEvent("sessions.changed", {
      sessionKey: initial.key,
      label: "Renamed",
      model: "anthropic/claude-sonnet-4-5",
      ts: 250,
    });

    expect(gatewayCalls).toEqual([{ method: "sessions.subscribe", params: {} }]);
    expect(sessionSignals.sessions.value).toEqual([
      {
        ...initial,
        label: "Renamed",
        model: "anthropic/claude-sonnet-4-5",
        updatedAt: 250,
      },
    ]);
    expect(cachedSessions).toEqual(sessionSignals.sessions.value);
    expect(sessionSignals.activeSession.value?.label).toBe("Renamed");
  });

  test("adds new sessions from sessions.changed and sorts them by recency", () => {
    const older = session({ key: "agent:main:chat:older", label: "Older", updatedAt: 50 });
    sessionSignals.sessions.value = [older];

    sessionSignals.initSessionEventSubscription();
    emitGatewayEvent("sessions.changed", {
      key: "agent:main:chat:new",
      kind: "isolated",
      label: "New",
      updatedAt: 500,
    });

    expect(sessionSignals.sessions.value.map((item) => item.key)).toEqual([
      "agent:main:chat:new",
      "agent:main:chat:older",
    ]);
    expect(sessionSignals.sessionsByRecent.value.map((item) => item.key)).toEqual([
      "agent:main:chat:new",
      "agent:main:chat:older",
    ]);
    expect(cachedSessions?.map((item) => item.key)).toEqual([
      "agent:main:chat:new",
      "agent:main:chat:older",
    ]);
  });

  test("uses updatedAt before ts and Date.now for session event timestamps", () => {
    const originalNow = Date.now;
    Date.now = () => 1_234;

    try {
      sessionSignals.initSessionEventSubscription();
      emitGatewayEvent("sessions.changed", {
        key: "agent:main:chat:updated-at",
        label: "UpdatedAt",
        ts: 200,
        updatedAt: 300,
      });
      emitGatewayEvent("sessions.changed", {
        key: "agent:main:chat:ts",
        label: "Timestamp",
        ts: 400,
      });
      emitGatewayEvent("sessions.changed", {
        key: "agent:main:chat:now",
        label: "Now",
      });

      expect(sessionSignals.sessions.value.map((item) => [item.key, item.updatedAt])).toEqual([
        ["agent:main:chat:now", 1_234],
        ["agent:main:chat:ts", 400],
        ["agent:main:chat:updated-at", 300],
      ]);
    } finally {
      Date.now = originalNow;
    }
  });

  test("removes deleted sessions and clears an active deleted session", () => {
    const keep = session({ key: "agent:main:chat:keep", label: "Keep" });
    const remove = session({ key: "agent:main:chat:remove", label: "Remove" });
    sessionSignals.sessions.value = [keep, remove];
    sessionSignals.setActiveSession(remove.key);

    sessionSignals.initSessionEventSubscription();
    emitGatewayEvent("sessions.changed", {
      sessionKey: remove.key,
      reason: "deleted",
    });

    expect(sessionSignals.sessions.value).toEqual([keep]);
    expect(sessionSignals.activeSessionKey.value).toBeNull();
    expect(cachedSessions).toEqual([keep]);
  });

  test("coalesces malformed sessions.changed events into one list refresh", async () => {
    const timers = installFakeTimers();
    sendResponder = (method) => {
      if (method === "sessions.subscribe") return { ok: true };
      if (method === "sessions.list") {
        return { sessions: [session({ key: "agent:main:chat:refreshed", label: "Refreshed" })] };
      }
      throw new Error(`Unexpected method: ${method}`);
    };

    try {
      sessionSignals.initSessionEventSubscription();
      emitGatewayEvent("sessions.changed", { reason: "unknown" });
      emitGatewayEvent("sessions.changed", null);

      timers.advanceBy(249);
      expect(gatewayCalls).toEqual([{ method: "sessions.subscribe", params: {} }]);

      timers.advanceBy(1);
      await Promise.resolve();

      expect(gatewayCalls).toEqual([
        { method: "sessions.subscribe", params: {} },
        { method: "sessions.list", params: { limit: 100 } },
      ]);
      expect(sessionSignals.sessions.value.map((item) => item.key)).toEqual([
        "agent:main:chat:refreshed",
      ]);
      expect(cachedSessions).toEqual(sessionSignals.sessions.value);
    } finally {
      timers.uninstall();
    }
  });

  test("reloads instead of caching a skeletal unknown session event", async () => {
    const timers = installFakeTimers();
    sendResponder = (method) => {
      if (method === "sessions.subscribe") return { ok: true };
      if (method === "sessions.list") {
        return { sessions: [session({ key: "agent:main:chat:real", label: "Real" })] };
      }
      throw new Error(`Unexpected method: ${method}`);
    };

    try {
      sessionSignals.initSessionEventSubscription();
      emitGatewayEvent("sessions.changed", {
        sessionKey: "agent:main:chat:unknown",
        ts: 999,
      });

      expect(sessionSignals.sessions.value).toEqual([]);

      timers.advanceBy(250);
      await Promise.resolve();

      expect(sessionSignals.sessions.value.map((item) => item.key)).toEqual([
        "agent:main:chat:real",
      ]);
      expect(cachedSessions).toEqual(sessionSignals.sessions.value);
    } finally {
      timers.uninstall();
    }
  });

  test("persists local session mutations to cache", () => {
    const initial = session({ key: "agent:main:chat:local", label: "Local" });
    sessionSignals.sessions.value = [initial];

    sessionSignals.updateSession(initial.key, { label: "Updated locally" });

    expect(cachedSessions).toEqual([{ ...initial, label: "Updated locally" }]);

    sessionSignals.clearSessions();

    expect(sessionSignals.sessions.value).toEqual([]);
    expect(cachedSessions).toEqual([]);
  });

  test("unsubscribes from session changes during cleanup", () => {
    sessionSignals.initSessionEventSubscription();
    expect(gatewayHandlers.get("sessions.changed")?.size).toBe(1);

    sessionSignals.cleanupSessionEventSubscription();

    expect(gatewayCalls).toEqual([
      { method: "sessions.subscribe", params: {} },
      { method: "sessions.unsubscribe", params: {} },
    ]);
    expect(gatewayHandlers.has("sessions.changed")).toBe(false);
  });
});
