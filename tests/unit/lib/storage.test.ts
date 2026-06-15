import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  clearAuth,
  getAuth,
  getMessagesCache,
  getMessageQueue,
  getModelFavorites,
  getSessionCredential,
  getSessionsCache,
  getSessionsUsageCache,
  getUsageCache,
  saveAuth,
  setMessagesCache,
  setMessageQueue,
  setModelFavorites,
  setSessionsCache,
  setSessionsUsageCache,
  setUsageCache,
} from "../../../src/lib/storage";
import { installStorageMocks } from "../../helpers/storage";

let restoreStorage: (() => void) | undefined;

beforeEach(() => {
  restoreStorage = installStorageMocks();
});

afterEach(() => {
  restoreStorage?.();
  restoreStorage = undefined;
});

describe("auth storage", () => {
  test("remember-me stores credentials in localStorage and clears stale session credentials", () => {
    sessionStorage.setItem("cove:session-auth", JSON.stringify({ credential: "stale-session" }));

    saveAuth({
      url: "wss://gateway.example.test",
      authMode: "token",
      rememberMe: true,
      credential: "remembered-token",
    });

    expect(localStorage.getItem("cove:auth")).toBe(
      JSON.stringify({
        url: "wss://gateway.example.test",
        authMode: "token",
        rememberMe: true,
      }),
    );
    expect(localStorage.getItem("cove:credential")).toBe(JSON.stringify("remembered-token"));
    expect(sessionStorage.getItem("cove:session-auth")).toBeNull();
    expect(getSessionCredential()).toBe("remembered-token");
  });

  test("non-remembered auth stores credentials in sessionStorage and clears stale remembered credentials", () => {
    localStorage.setItem("cove:credential", JSON.stringify("stale-remembered"));

    saveAuth({
      url: "wss://gateway.example.test",
      authMode: "password",
      rememberMe: false,
      credential: "session-password",
    });

    expect(localStorage.getItem("cove:auth")).toBe(
      JSON.stringify({
        url: "wss://gateway.example.test",
        authMode: "password",
        rememberMe: false,
      }),
    );
    expect(localStorage.getItem("cove:credential")).toBeNull();
    expect(sessionStorage.getItem("cove:session-auth")).toBe(
      JSON.stringify({ credential: "session-password" }),
    );
    expect(getSessionCredential()).toBe("session-password");
  });

  test("getAuth migrates legacy embedded credentials out of persisted auth", () => {
    localStorage.setItem(
      "cove:auth",
      JSON.stringify({
        url: "wss://gateway.example.test",
        authMode: "token",
        rememberMe: true,
        credential: "legacy-token",
      }),
    );

    expect(getAuth()).toEqual({
      url: "wss://gateway.example.test",
      authMode: "token",
      rememberMe: true,
    });
    expect(localStorage.getItem("cove:auth")).toBe(
      JSON.stringify({
        url: "wss://gateway.example.test",
        authMode: "token",
        rememberMe: true,
      }),
    );
    expect(localStorage.getItem("cove:credential")).toBe(JSON.stringify("legacy-token"));
    expect(sessionStorage.getItem("cove:session-auth")).toBeNull();
    expect(getSessionCredential()).toBe("legacy-token");
  });

  test("clearAuth removes auth preferences and credentials from both storage scopes", () => {
    localStorage.setItem(
      "cove:auth",
      JSON.stringify({
        url: "wss://gateway.example.test",
        authMode: "token",
        rememberMe: true,
      }),
    );
    localStorage.setItem("cove:credential", JSON.stringify("remembered-token"));
    sessionStorage.setItem("cove:session-auth", JSON.stringify({ credential: "session-token" }));

    clearAuth();

    expect(localStorage.getItem("cove:auth")).toBeNull();
    expect(localStorage.getItem("cove:credential")).toBeNull();
    expect(sessionStorage.getItem("cove:session-auth")).toBeNull();
    expect(getAuth()).toBeNull();
    expect(getSessionCredential()).toBeNull();
  });

  test("corrupted auth and credential storage fall back without throwing", () => {
    localStorage.setItem("cove:auth", "{not-json");
    localStorage.setItem("cove:credential", "{not-json");
    sessionStorage.setItem("cove:session-auth", "{not-json");

    expect(getAuth()).toBeNull();
    expect(getSessionCredential()).toBeNull();
  });

  test("clearAuth keeps unrelated preferences and caches intact", () => {
    localStorage.setItem("cove:time-format", JSON.stringify("local"));
    setMessagesCache("agent:main:main", [
      { id: "msg-1", role: "user", content: "hello", timestamp: 1 },
    ]);
    setModelFavorites(new Set(["gpt-5.4"]));
    saveAuth({
      url: "wss://gateway.example.test",
      authMode: "token",
      rememberMe: true,
      credential: "remembered-token",
    });

    clearAuth();

    expect(localStorage.getItem("cove:time-format")).toBe(JSON.stringify("local"));
    expect(getMessagesCache()).toEqual({
      sessionKey: "agent:main:main",
      messages: [{ id: "msg-1", role: "user", content: "hello", timestamp: 1 }],
    });
    expect(getModelFavorites()).toEqual(new Set(["gpt-5.4"]));
  });
});

describe("cache storage", () => {
  test("persists and restores message, session, usage, and session usage caches", () => {
    const message = { id: "msg-1", role: "assistant" as const, content: "cached", timestamp: 1 };
    const session = { key: "agent:main:main", label: "Main", updatedAt: 2 };
    const usage = {
      updatedAt: 3,
      providers: [
        {
          provider: "openai-codex" as const,
          displayName: "OpenAI Codex",
          windows: [{ label: "5h", usedPercent: 42, resetAt: 4 }],
        },
      ],
    };
    const sessionsUsage = {
      sessions: [
        {
          key: "agent:main:main",
          usage: {
            input: 1,
            output: 2,
            totalTokens: 3,
            cacheRead: 4,
            cacheWrite: 5,
            totalCost: 0.01,
          },
        },
      ],
      totals: {
        input: 1,
        output: 2,
        totalTokens: 3,
        cacheRead: 4,
        cacheWrite: 5,
        totalCost: 0.01,
      },
    };

    setMessagesCache("agent:main:main", [message]);
    setSessionsCache([session]);
    setUsageCache(usage);
    setSessionsUsageCache(sessionsUsage);

    expect(getMessagesCache()).toEqual({ sessionKey: "agent:main:main", messages: [message] });
    expect(getSessionsCache()).toEqual([session]);
    expect(getUsageCache()).toEqual(usage);
    expect(getSessionsUsageCache()).toEqual(sessionsUsage);
  });

  test("persists pending steered queue items across reload storage", () => {
    const queueItem = {
      id: "steer-1",
      role: "user" as const,
      content: "tighten the plan",
      timestamp: 1,
      sessionKey: "session-1",
      status: "sent" as const,
      queueKind: "steered" as const,
      pendingRunId: "run-active",
    };

    setMessageQueue([queueItem]);

    expect(getMessageQueue()).toEqual([queueItem]);
  });

  test("corrupted cache JSON falls back without throwing", () => {
    localStorage.setItem("cove:messages-session", JSON.stringify("agent:main:main"));
    localStorage.setItem("cove:messages-cache", "{not-json");
    localStorage.setItem("cove:sessions-cache", "{not-json");
    localStorage.setItem("cove:usage-cache", "{not-json");
    localStorage.setItem("cove:sessions-usage-cache", "{not-json");
    localStorage.setItem("cove:model-favorites", "{not-json");

    expect(getMessagesCache()).toBeNull();
    expect(getSessionsCache()).toBeNull();
    expect(getUsageCache()).toBeNull();
    expect(getSessionsUsageCache()).toBeNull();
    expect(getModelFavorites()).toEqual(new Set());
  });

  test("message cache requires both session key and messages", () => {
    localStorage.setItem("cove:messages-session", JSON.stringify("agent:main:main"));
    expect(getMessagesCache()).toBeNull();

    localStorage.removeItem("cove:messages-session");
    localStorage.setItem(
      "cove:messages-cache",
      JSON.stringify([{ id: "msg-1", role: "user", content: "orphaned", timestamp: 1 }]),
    );

    expect(getMessagesCache()).toBeNull();
  });
});
