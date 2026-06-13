import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { GatewayConfig } from "../../../src/views/agents/agents-tools-state";
import type { Agent } from "../../../src/types/agents";

type SendCall = {
  method: string;
  params: unknown;
};

const sendCalls: SendCall[] = [];
const successToasts: string[] = [];
const errorToasts: string[] = [];

let agentsListResult: {
  agents: Agent[];
  defaultId: string;
  mainKey: string;
  scope: "global" | "per-sender";
};
let configGetResult: {
  config: GatewayConfig;
  exists: boolean;
  hash: string | null;
  raw: string;
  valid: boolean;
};
let createAgentResult: { agentId: string; ok: boolean };
let filesListResult: { files: unknown[]; workspace: string };
let skillsStatusResult: { skills: unknown[] };

mock.module("@/lib/gateway", () => ({
  send: (method: string, params: unknown) => sendResponder.value(method, params),
}));

mock.module("@/lib/session-utils", () => ({
  getErrorMessage: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));

mock.module("@/lib/i18n", () => ({
  t: (key: string) => key,
}));

mock.module("@/components/ui/Toast", () => ({
  toast: {
    error: (message: string) => {
      errorToasts.push(message);
      return "error-toast";
    },
    success: (message: string) => {
      successToasts.push(message);
      return "success-toast";
    },
  },
}));

const {
  activeTab,
  agents,
  createEmoji,
  createModalOpen,
  createName,
  createSaving,
  createWorkspace,
  deleteConfirmText,
  deleteDeleting,
  deleteIncludeFiles,
  deleteModalOpen,
  editAvatar,
  editModel,
  editName,
  editWorkspace,
  files,
  isLoading,
  overviewEditing,
  overviewSaving,
  selectedAgentId,
  workspacePath,
} = await import("../../../src/views/agents/agents-core-state");
const { agentSkillsAllowlist, localSkillsAllowlist, skills } =
  await import("../../../src/views/agents/agents-skills-state");
const { gatewayConfig, gatewayConfigHash, localToolsConfig, toolsDirty, toolsLoading } =
  await import("../../../src/views/agents/agents-tools-state");
const { createAgent, deleteAgent, saveOverviewEdit, selectAgent, selectTab, startOverviewEdit } =
  await import("../../../src/views/agents/agents-actions");

describe("agents actions", () => {
  beforeEach(() => {
    sendCalls.length = 0;
    successToasts.length = 0;
    errorToasts.length = 0;
    sendResponder.value = defaultSendResponder;

    agentsListResult = {
      agents: [{ id: "agent-1", identity: { avatar: "old-avatar", name: "Old Name" } }],
      defaultId: "agent-1",
      mainKey: "main",
      scope: "global",
    };
    configGetResult = {
      config: {
        tools: { profile: "full" },
        agents: {
          list: [
            {
              id: "agent-1",
              model: "old-model",
              skills: ["agent-1-skill"],
              tools: { deny: ["exec"], profile: "coding" },
            },
            {
              id: "agent-2",
              skills: ["agent-2-skill"],
              tools: { alsoAllow: ["web_search"], profile: "minimal" },
            },
          ],
        },
      },
      exists: true,
      hash: "hash-after",
      raw: "{}",
      valid: true,
    };
    createAgentResult = { agentId: "agent-2", ok: true };
    filesListResult = { files: [{ name: "AGENTS.md" }], workspace: "/repo" };
    skillsStatusResult = { skills: [] };

    activeTab.value = "overview";
    agents.value = [...agentsListResult.agents];
    createEmoji.value = "";
    createModalOpen.value = false;
    createName.value = "";
    createSaving.value = false;
    createWorkspace.value = "";
    deleteConfirmText.value = "";
    deleteDeleting.value = false;
    deleteIncludeFiles.value = false;
    deleteModalOpen.value = false;
    editAvatar.value = "";
    editModel.value = "";
    editName.value = "";
    editWorkspace.value = "";
    files.value = [];
    gatewayConfig.value = configGetResult.config;
    gatewayConfigHash.value = "hash-before";
    isLoading.value = false;
    localSkillsAllowlist.value = null;
    localToolsConfig.value = {};
    overviewEditing.value = true;
    overviewSaving.value = false;
    selectedAgentId.value = "agent-1";
    skills.value = [];
    toolsDirty.value = false;
    toolsLoading.value = false;
    workspacePath.value = "/repo";
  });

  test("saveOverviewEdit sends only changed fields and supports clearing avatar", async () => {
    editName.value = " New Name ";
    editAvatar.value = " ";
    editWorkspace.value = "/repo";
    editModel.value = "new-model";

    await saveOverviewEdit();

    expect(sendCalls.map((call) => call.method)).toEqual([
      "agents.update",
      "agents.list",
      "agents.files.list",
    ]);
    expect(sendCalls[0].params).toEqual({
      agentId: "agent-1",
      avatar: "",
      model: "new-model",
      name: "New Name",
    });
    expect(overviewEditing.value).toBe(false);
    expect(overviewSaving.value).toBe(false);
    expect(successToasts).toEqual(["actions.saved"]);
  });

  test("startOverviewEdit and saveOverviewEdit can clear avatarUrl-only identities", async () => {
    agents.value = [{ id: "agent-1", identity: { avatarUrl: "https://example.test/avatar.png" } }];

    await startOverviewEdit();
    expect(editAvatar.value).toBe("https://example.test/avatar.png");

    editAvatar.value = "";
    await saveOverviewEdit();

    expect(sendCalls.at(-3)?.method).toBe("agents.update");
    expect(sendCalls.at(-3)?.params).toEqual({ agentId: "agent-1", avatar: "" });
  });

  test("saveOverviewEdit skips no-op updates", async () => {
    editName.value = "Old Name";
    editAvatar.value = "old-avatar";
    editWorkspace.value = "/repo";
    editModel.value = "old-model";

    await saveOverviewEdit();

    expect(sendCalls).toEqual([]);
    expect(overviewEditing.value).toBe(false);
    expect(overviewSaving.value).toBe(false);
    expect(successToasts).toEqual([]);
  });

  test("createAgent trims fields, selects the returned agent, and reloads dependent state", async () => {
    createModalOpen.value = true;
    createName.value = " Research ";
    createWorkspace.value = " /work/research ";
    createEmoji.value = " 🧪 ";
    agentsListResult = {
      agents: [
        { id: "agent-1", name: "Agent One", workspace: "/repo" },
        { id: "agent-2", name: "Research", workspace: "/work/research" },
      ],
      defaultId: "agent-1",
      mainKey: "main",
      scope: "global",
    };

    await createAgent();

    expect(sendCalls.map((call) => call.method)).toEqual([
      "agents.create",
      "agents.list",
      "agents.files.list",
      "config.get",
    ]);
    expect(sendCalls[0].params).toEqual({
      emoji: "🧪",
      name: "Research",
      workspace: "/work/research",
    });
    expect((sendCalls[2].params as { agentId: string }).agentId).toBe("agent-2");
    expect(selectedAgentId.value).toBe("agent-2");
    expect(createModalOpen.value).toBe(false);
    expect(createSaving.value).toBe(false);
    expect(successToasts).toEqual(["agents.create.success"]);
  });

  test("deleteAgent requires exact confirmation and passes deleteFiles", async () => {
    agents.value = [
      { id: "agent-1", name: "Agent One" },
      { id: "agent-2", name: "Agent Two" },
    ];
    agentsListResult = {
      agents: [{ id: "agent-2", name: "Agent Two" }],
      defaultId: "agent-2",
      mainKey: "main",
      scope: "global",
    };
    deleteModalOpen.value = true;
    deleteConfirmText.value = "Agent-1";
    deleteIncludeFiles.value = true;

    await deleteAgent();

    expect(sendCalls).toEqual([]);
    expect(errorToasts).toEqual(["agents.delete.confirmMismatch"]);

    deleteConfirmText.value = "agent-1";
    await deleteAgent();

    expect(sendCalls.map((call) => call.method)).toEqual([
      "agents.delete",
      "agents.list",
      "agents.files.list",
      "config.get",
    ]);
    expect(sendCalls[0].params).toEqual({ agentId: "agent-1", deleteFiles: true });
    expect((sendCalls[2].params as { agentId: string }).agentId).toBe("agent-2");
    expect(selectedAgentId.value).toBe("agent-2");
    expect(deleteModalOpen.value).toBe(false);
    expect(deleteDeleting.value).toBe(false);
    expect(successToasts).toEqual(["agents.delete.success"]);
  });

  test("selectAgent re-derives local tools and skills from loaded config", async () => {
    activeTab.value = "files";
    selectedAgentId.value = "agent-1";

    selectAgent("agent-2");
    await flushPromises();

    expect(sendCalls.map((call) => call.method)).toEqual(["agents.files.list"]);
    expect(localToolsConfig.value).toEqual({
      alsoAllow: ["web_search"],
      deny: [],
      profile: "minimal",
    });
    expect(localSkillsAllowlist.value).toEqual(["agent-2-skill"]);
  });

  test("selectTab reloads missing data and does not keep stale selected-agent config", async () => {
    gatewayConfig.value = configGetResult.config;
    selectedAgentId.value = "agent-2";
    localToolsConfig.value = { deny: ["exec"], profile: "coding" };
    agentSkillsAllowlist.value = ["agent-1-skill"];

    selectTab("tools");
    await flushPromises();
    expect(sendCalls).toEqual([]);
    expect(localToolsConfig.value).toEqual({
      alsoAllow: ["web_search"],
      deny: [],
      profile: "minimal",
    });

    selectTab("skills");
    await flushPromises();
    expect(sendCalls.map((call) => call.method)).toEqual(["skills.status"]);
    expect(localSkillsAllowlist.value).toEqual(["agent-2-skill"]);

    sendCalls.length = 0;
    gatewayConfig.value = null;
    selectTab("overview");
    await flushPromises();
    expect(sendCalls.map((call) => call.method)).toEqual(["config.get"]);
  });
});

type SendResponder = (method: string, params: unknown) => Promise<unknown>;

const defaultSendResponder: SendResponder = async (method: string, params: unknown) => {
  sendCalls.push({ method, params });
  if (method === "agents.update") return { ok: true };
  if (method === "agents.create") return createAgentResult;
  if (method === "agents.delete") return { ok: true };
  if (method === "agents.list") return agentsListResult;
  if (method === "agents.files.list") return filesListResult;
  if (method === "config.get") return configGetResult;
  if (method === "skills.status") return skillsStatusResult;
  throw new Error(`Unexpected gateway method ${method}`);
};

const sendResponder = {
  value: defaultSendResponder,
};

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
