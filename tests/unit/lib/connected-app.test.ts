import { beforeEach, describe, expect, mock, test } from "bun:test";
import { computed, signal } from "@preact/signals";
import { createUpdateSignalsMock } from "../../helpers/module-mocks";

const calls: string[] = [];
const sessions = signal([]);
const activeSessionKey = signal<string | null>(null);
const appMode = signal("single");
const canvasNodeEnabled = signal(false);
const updateSignals = createUpdateSignalsMock({
  initUpdateSubscription: () => {
    calls.push("initUpdateSubscription");
  },
});

mock.module("@/signals/agents", () => ({
  loadAgents: async () => {
    calls.push("loadAgents");
  },
}));

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

mock.module("@/signals/update", () => updateSignals);

mock.module("@/signals/usage", () => ({
  startUsagePolling: () => {
    calls.push("startUsagePolling");
  },
}));

mock.module("@/signals/settings", () => ({
  appMode,
  canvasNodeEnabled,
}));

mock.module("@/lib/node-connection", () => ({
  startNodeConnection: () => {
    calls.push("startNodeConnection");
  },
  stopNodeConnection: () => undefined,
}));

const { initConnectedApp, initPostConnectApp } = await import("../../../src/lib/connected-app");

beforeEach(() => {
  calls.length = 0;
  activeSessionKey.value = null;
  appMode.value = "single";
  canvasNodeEnabled.value = false;
  sessions.value = [];
  updateSignals.reset();
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

  test("runs the full shared post-connect bootstrap used by every login path", async () => {
    canvasNodeEnabled.value = true;

    await initPostConnectApp();

    expect(calls).toEqual([
      "loadAgents",
      "loadSessions",
      "initSessionEventSubscription",
      "loadAssistantIdentity",
      "setActiveSession:main",
      "initChat:main",
      "startUsagePolling",
      "loadModels",
      "initExecApproval",
      "initUpdateSubscription",
      "startNodeConnection",
    ]);
  });

  test("can defer canvas node startup until fresh credentials are persisted", async () => {
    canvasNodeEnabled.value = true;

    await initPostConnectApp({ startCanvasNode: false });

    expect(calls).toEqual([
      "loadAgents",
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
