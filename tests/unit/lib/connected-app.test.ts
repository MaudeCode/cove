import { beforeEach, describe, expect, mock, test } from "bun:test";
import { computed, signal } from "@preact/signals";

const calls: string[] = [];
const sessions = signal([]);
const activeSessionKey = signal<string | null>(null);

mock.module("@/lib/chat/init", () => ({
  cleanupChat: () => undefined,
  initChat: async (sessionKey: string) => {
    calls.push(`initChat:${sessionKey}`);
  },
}));

mock.module("@/signals/identity", () => ({
  loadAssistantIdentity: async () => {
    calls.push("loadAssistantIdentity");
  },
}));

mock.module("@/signals/models", () => ({
  loadModels: () => {
    calls.push("loadModels");
  },
}));

mock.module("@/signals/exec", () => ({
  cleanupExecApproval: () => undefined,
  execApprovalBusy: signal(false),
  execApprovalError: signal<string | null>(null),
  execApprovalQueue: signal([]),
  handleExecApprovalDecisionDirect: async () => undefined,
  initExecApproval: () => {
    calls.push("initExecApproval");
  },
  resolvedApprovalIds: signal(new Map()),
}));

mock.module("@/signals/sessions", () => ({
  activeSession: computed(() => null),
  activeSessionKey,
  clearSessions: () => undefined,
  cleanupSessionEventSubscription: () => undefined,
  deletingSessionKey: signal<string | null>(null),
  effectiveSessionKey: computed(() => activeSessionKey.value),
  initSessionEventSubscription: () => {
    calls.push("initSessionEventSubscription");
  },
  isForActiveSession: () => true,
  loadSessions: async () => {
    calls.push("loadSessions");
  },
  setActiveSession: (sessionKey: string) => {
    activeSessionKey.value = sessionKey;
    calls.push(`setActiveSession:${sessionKey}`);
  },
  setSessionKindFilter: () => undefined,
  setSessionSearchQuery: () => undefined,
  sessionKindFilter: signal<string | null>(null),
  sessionSearchQuery: signal(""),
  sessions,
  sessionsByRecent: computed(() => sessions.value),
  sessionsGrouped: computed(() => []),
  showCronSessions: signal(false),
  toggleCronSessions: () => undefined,
  updateSession: () => undefined,
}));

mock.module("@/signals/update", () => ({
  initUpdateSubscription: () => {
    calls.push("initUpdateSubscription");
  },
}));

mock.module("@/signals/usage", () => ({
  startUsagePolling: () => {
    calls.push("startUsagePolling");
  },
}));

const { initConnectedApp } = await import("../../../src/lib/connected-app");

beforeEach(() => {
  calls.length = 0;
  activeSessionKey.value = null;
  sessions.value = [];
});

describe("connected app initialization", () => {
  test("runs shared post-connect loaders and subscriptions in order", async () => {
    await initConnectedApp();

    expect(calls).toEqual([
      "loadSessions",
      "initSessionEventSubscription",
      "loadAssistantIdentity",
      "setActiveSession:main",
      "initChat:main",
      "startUsagePolling",
      "loadModels",
      "initExecApproval",
      "initUpdateSubscription",
    ]);
  });
});
