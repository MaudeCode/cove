import { beforeEach, describe, expect, mock, test } from "bun:test";
import { signal } from "@preact/signals";
import { installI18nMock } from "../../helpers/i18n";
import { createGatewayMock, createQueryParamMock } from "../../helpers/module-mocks";
import type { Session } from "../../../src/types/sessions";

type SendCall = {
  method: string;
  params: unknown;
};

const isConnected = signal(false);
const sendCalls: SendCall[] = [];
let sendResponder: (method: string, params?: unknown) => unknown = () => ({ ok: true });

mock.module("@/lib/gateway", () =>
  createGatewayMock({
    isConnected,
    send: (method: string, params?: unknown) => {
      sendCalls.push({ method, params });
      return sendResponder(method, params);
    },
  }),
);

installI18nMock({ t: (key: string) => key });

mock.module("@/lib/session-utils", () => ({
  getErrorMessage: (err: unknown) => (err instanceof Error ? err.message : String(err)),
  getSessionDisplayKind: (item: Session) => {
    if (item.key.includes(":cron:")) return "cron";
    if (item.kind === "group" || item.kind === "channel" || item.channel) return "channel";
    if (item.kind === "main" || item.key === "agent:main:main") return "main";
    return "isolated";
  },
}));
mock.module("@/hooks/useQueryParam", () => createQueryParamMock());

const sessionsAdminState = await import("../../../src/views/sessions-admin/useSessionsAdminState");
const {
  adminSessions,
  cancelInlineEdit,
  closeSessionDetail,
  deleteSession,
  editLabel,
  editReasoning,
  editThinking,
  editVerbose,
  error,
  filteredSessions,
  formatContextUsage,
  formatTokenCount,
  getDisplayName,
  handleSessionRowKeyDown,
  inlineEditKey,
  inlineEditValue,
  isDeleting,
  isLoading,
  isSaving,
  kindFilter,
  loadAdminSessions,
  openSessionDetail,
  saveInlineEdit,
  saveSession,
  searchQuery,
  selectedSession,
  sessionCounts,
  startInlineEdit,
  stopInlineEditPropagation,
} = sessionsAdminState;

function session(overrides: Partial<Session> = {}): Session {
  return {
    key: "agent:main:chat:one",
    kind: "isolated",
    label: "Alpha",
    displayName: "Display Alpha",
    model: "anthropic/claude-sonnet",
    updatedAt: 200,
    totalTokens: 1_234,
    contextTokens: 10_000,
    ...overrides,
  };
}

function resetSessionsAdminState(): void {
  adminSessions.value = [];
  isLoading.value = false;
  error.value = null;
  searchQuery.value = "";
  kindFilter.value = "all";
  selectedSession.value = null;
  isDeleting.value = false;
  isSaving.value = false;
  inlineEditKey.value = null;
  inlineEditValue.value = "";
  editLabel.value = "";
  editThinking.value = "inherit";
  editVerbose.value = "inherit";
  editReasoning.value = "inherit";
}

describe("sessions admin state", () => {
  beforeEach(() => {
    resetSessionsAdminState();
    isConnected.value = false;
    sendCalls.length = 0;
    sendResponder = () => ({ ok: true });
  });

  test("loads, filters, sorts, and formats sessions", async () => {
    const main = session({
      key: "agent:main:main",
      kind: "main",
      label: "Main",
      updatedAt: 1,
      totalTokens: 500,
    });
    const channel = session({
      key: "agent:main:channel:discord",
      kind: "group",
      label: "Discord",
      channel: "discord",
      updatedAt: 300,
    });
    const cron = session({
      key: "agent:main:cron:job",
      label: "Nightly cron",
      updatedAt: 250,
    });
    sendResponder = (method) => {
      expect(method).toBe("sessions.list");
      return { sessions: [channel, cron, main] };
    };

    await loadAdminSessions();

    expect(sendCalls).toEqual([{ method: "sessions.list", params: { limit: 200 } }]);
    expect(sessionCounts.value).toEqual({ total: 3, main: 1, channel: 1, cron: 1, isolated: 0 });
    expect(filteredSessions.value.map((item) => item.key)).toEqual([
      "agent:main:main",
      "agent:main:channel:discord",
      "agent:main:cron:job",
    ]);

    kindFilter.value = "channel";
    searchQuery.value = "disc";
    expect(filteredSessions.value.map((item) => item.key)).toEqual(["agent:main:channel:discord"]);
    expect(formatTokenCount(main)).toBe("500");
    expect(formatContextUsage(main)).toBe("5%");
    expect(getDisplayName(session({ displayName: "", label: "" }))).toBe("one");
  });

  test("saveSession sends only changed fields and updates local state", async () => {
    const editable = session({
      key: "agent:main:chat:editable",
      label: "Alpha",
      thinkingLevel: "high",
      verboseLevel: "low",
      reasoningLevel: "medium",
    });
    adminSessions.value = [editable];
    openSessionDetail(editable);

    editLabel.value = "";
    editThinking.value = "inherit";
    editVerbose.value = "low";
    editReasoning.value = "high";

    await saveSession();

    expect(sendCalls).toEqual([
      {
        method: "sessions.patch",
        params: {
          key: "agent:main:chat:editable",
          label: undefined,
          thinkingLevel: null,
          reasoningLevel: "high",
        },
      },
    ]);
    expect(adminSessions.value[0]).toMatchObject({
      key: "agent:main:chat:editable",
      label: undefined,
      thinkingLevel: null,
      verboseLevel: "low",
      reasoningLevel: "high",
    });
    expect(selectedSession.value).toBeNull();
    expect(isSaving.value).toBe(false);
  });

  test("canonical override fields win over stale legacy fields", async () => {
    const legacyOnly = session({
      key: "agent:main:chat:legacy",
      thinking: "high",
      verbose: "medium",
      reasoning: "low",
    });
    openSessionDetail(legacyOnly);
    expect(editThinking.value).toBe("high");
    expect(editVerbose.value).toBe("medium");
    expect(editReasoning.value).toBe("low");

    const canonicalNull = session({
      key: "agent:main:chat:canonical",
      thinking: "high",
      thinkingLevel: null,
      verbose: "medium",
      verboseLevel: null,
      reasoning: "low",
      reasoningLevel: null,
    });
    openSessionDetail(canonicalNull);
    expect(editThinking.value).toBe("inherit");
    expect(editVerbose.value).toBe("inherit");
    expect(editReasoning.value).toBe("inherit");

    adminSessions.value = [legacyOnly];
    openSessionDetail(legacyOnly);
    editThinking.value = "inherit";

    await saveSession();

    expect(sendCalls).toEqual([
      {
        method: "sessions.patch",
        params: { key: "agent:main:chat:legacy", thinkingLevel: null },
      },
    ]);
    openSessionDetail(adminSessions.value[0]);
    expect(editThinking.value).toBe("inherit");
  });

  test("saveInlineEdit trims labels, skips unchanged edits, and clears empty labels", async () => {
    adminSessions.value = [session({ key: "agent:main:chat:inline", label: "Alpha" })];

    inlineEditKey.value = "agent:main:chat:inline";
    inlineEditValue.value = "Alpha";
    await saveInlineEdit();
    expect(sendCalls).toEqual([]);
    expect(inlineEditKey.value).toBeNull();

    inlineEditKey.value = "agent:main:chat:inline";
    inlineEditValue.value = "  Beta  ";
    await saveInlineEdit();
    expect(sendCalls.at(-1)).toEqual({
      method: "sessions.patch",
      params: { key: "agent:main:chat:inline", label: "Beta" },
    });
    expect(adminSessions.value[0].label).toBe("Beta");
    expect(inlineEditKey.value).toBeNull();

    inlineEditKey.value = "agent:main:chat:inline";
    inlineEditValue.value = "   ";
    await saveInlineEdit();
    expect(sendCalls.at(-1)).toEqual({
      method: "sessions.patch",
      params: { key: "agent:main:chat:inline", label: undefined },
    });
    expect(adminSessions.value[0].label).toBeUndefined();
  });

  test("deleteSession removes the local item after the gateway delete succeeds", async () => {
    const keep = session({ key: "agent:main:chat:keep", label: "Keep" });
    const remove = session({ key: "agent:main:chat:remove", label: "Remove" });
    adminSessions.value = [keep, remove];
    openSessionDetail(remove);

    await deleteSession();

    expect(sendCalls).toEqual([
      { method: "sessions.delete", params: { key: "agent:main:chat:remove" } },
    ]);
    expect(adminSessions.value).toEqual([keep]);
    expect(selectedSession.value).toBeNull();
  });

  test("close and cancel helpers reset modal and inline edit state", () => {
    const current = session();
    openSessionDetail(current);
    isDeleting.value = true;
    closeSessionDetail();
    expect(selectedSession.value).toBeNull();
    expect(isDeleting.value).toBe(false);

    inlineEditKey.value = current.key;
    inlineEditValue.value = "Draft";
    cancelInlineEdit();
    expect(inlineEditKey.value).toBeNull();
  });

  test("startInlineEdit stops row activation and seeds inline label state", () => {
    const current = session({ key: "agent:main:chat:inline", label: "Inline label" });
    const stopPropagation = mock(() => undefined);

    startInlineEdit(current, { stopPropagation } as unknown as Event);

    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(inlineEditKey.value).toBe("agent:main:chat:inline");
    expect(inlineEditValue.value).toBe("Inline label");
  });

  test("sessions list keyboard helpers open rows and block inline-edit propagation", () => {
    const current = session({
      key: "agent:main:chat:keyboard",
      label: "Keyboard label",
      displayName: "",
    });
    const preventDefault = mock(() => undefined);

    handleSessionRowKeyDown(current, false, { key: "Enter", preventDefault });
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(selectedSession.value?.key).toBe("agent:main:chat:keyboard");
    closeSessionDetail();

    handleSessionRowKeyDown(current, false, { key: " ", preventDefault });
    expect(preventDefault).toHaveBeenCalledTimes(2);
    expect(selectedSession.value?.key).toBe("agent:main:chat:keyboard");
    closeSessionDetail();

    handleSessionRowKeyDown(current, true, { key: "Enter", preventDefault });
    expect(preventDefault).toHaveBeenCalledTimes(2);
    expect(selectedSession.value).toBeNull();

    const stopPropagation = mock(() => undefined);
    stopInlineEditPropagation({ stopPropagation });
    expect(stopPropagation).toHaveBeenCalledTimes(1);
  });
});
