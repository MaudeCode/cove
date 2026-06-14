import { beforeEach, describe, expect, mock, test } from "bun:test";
import { installI18nMock } from "../../helpers/i18n";
import { createGatewayMock } from "../../helpers/module-mocks";
import type { GatewayConfig } from "../../../src/views/agents/agents-tools-state";

type SendCall = {
  method: string;
  params: unknown;
};

const sendCalls: SendCall[] = [];
const successToasts: string[] = [];
const errorToasts: string[] = [];
let applyError: Error | null = null;
let configGetResult: {
  config: GatewayConfig;
  exists: boolean;
  hash: string | null;
  raw: string;
  valid: boolean;
};

mock.module("@/lib/gateway", () => ({
  ...createGatewayMock({
    isConnected: { value: true },
    lastError: { value: null },
    mainSessionKey: { value: "main" },
    send: (method: string, params: unknown) => sendResponder.value(method, params),
  }),
  send: (method: string, params: unknown) => sendResponder.value(method, params),
}));

mock.module("@/lib/session-utils", () => ({
  getErrorMessage: (err: unknown) => (err instanceof Error ? err.message : String(err)),
  isUserCreatedChat: (sessionKey: string) => /^agent:[^:]+:chat:[^:]+$/.test(sessionKey),
}));

installI18nMock({ t: (key: string) => key });

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

mock.module("@/types/agents", () => ({
  formatAgentName: (agent: { id?: string; name?: string }) => agent.name ?? agent.id ?? "agent",
}));

const { selectedAgentId } = await import("../../../src/views/agents/agents-core-state");
const {
  gatewayConfig,
  gatewayConfigHash,
  localToolsConfig,
  toggleTool,
  saveToolsConfig,
  toolsDirty,
  toolsSaving,
} = await import("../../../src/views/agents/agents-tools-state");
const {
  agentSkillsAllowlist,
  clearSkillsAllowlist,
  disableAllSkills,
  enableAllSkills,
  localSkillsAllowlist,
  loadSkills,
  saveSkillsAllowlist,
  skills,
  skillsDirty,
  skillsSaving,
  syncSkillsAllowlist,
  toggleSkillInAllowlist,
} = await import("../../../src/views/agents/agents-skills-state");

describe("agents config mutation state", () => {
  beforeEach(() => {
    sendCalls.length = 0;
    successToasts.length = 0;
    errorToasts.length = 0;
    applyError = null;
    sendResponder.value = defaultSendResponder;
    configGetResult = {
      config: {},
      exists: true,
      hash: "hash-after",
      raw: "{}",
      valid: true,
    };

    selectedAgentId.value = "agent-1";
    gatewayConfig.value = null;
    gatewayConfigHash.value = null;
    localToolsConfig.value = {};
    toolsDirty.value = false;
    toolsSaving.value = false;
    skills.value = [];
    syncSkillsAllowlist(null);
    skillsSaving.value = false;
  });

  test("saveToolsConfig applies agent tools while preserving unrelated fields and omitting empty lists", async () => {
    gatewayConfig.value = {
      tools: { profile: "full" },
      agents: {
        defaults: { model: { primary: "default-model" } },
        list: [
          {
            id: "agent-1",
            model: { primary: "agent-model", fallbacks: ["fallback-model"] },
            skills: ["existing-skill"],
            tools: { allow: ["read"], deny: ["exec"], profile: "minimal" },
          },
          { id: "other-agent", model: "other-model", tools: { profile: "coding" } },
        ],
      },
    };
    gatewayConfigHash.value = "hash-before";
    localToolsConfig.value = { alsoAllow: [], deny: [], profile: "coding" };
    toolsDirty.value = true;
    configGetResult = {
      config: { agents: { list: [{ id: "agent-1", tools: { profile: "coding" } }] } },
      exists: true,
      hash: "hash-after",
      raw: "{}",
      valid: true,
    };

    await saveToolsConfig();

    const applied = parseAppliedConfig();
    const agent = applied.agents?.list?.[0];
    expect(sendCalls.map((call) => call.method)).toEqual(["config.apply", "config.get"]);
    expect((sendCalls[0].params as { baseHash?: string }).baseHash).toBe("hash-before");
    expect((sendCalls[0].params as { sessionKey?: string }).sessionKey).toBe("main");
    expect(agent).toEqual({
      id: "agent-1",
      model: { primary: "agent-model", fallbacks: ["fallback-model"] },
      skills: ["existing-skill"],
      tools: { profile: "coding" },
    });
    expect("allow" in (agent?.tools ?? {})).toBe(false);
    expect("alsoAllow" in (agent?.tools ?? {})).toBe(false);
    expect("deny" in (agent?.tools ?? {})).toBe(false);
    expect(applied.agents?.list?.[1]).toEqual({
      id: "other-agent",
      model: "other-model",
      tools: { profile: "coding" },
    });
    expect(gatewayConfigHash.value).toBe("hash-after");
    expect(toolsDirty.value).toBe(false);
    expect(toolsSaving.value).toBe(false);
    expect(successToasts).toEqual(["actions.saved"]);
  });

  test("saveToolsConfig creates missing agent entries and keeps dirty state on failure", async () => {
    gatewayConfig.value = {
      tools: { profile: "full" },
      agents: {
        defaults: { model: "default-model" },
        list: [{ id: "other-agent", tools: { profile: "minimal" } }],
      },
    };
    gatewayConfigHash.value = "hash-before";
    selectedAgentId.value = "new-agent";
    localToolsConfig.value = { alsoAllow: ["web_search"], deny: [], profile: "minimal" };
    toolsDirty.value = true;

    await saveToolsConfig();

    expect(parseAppliedConfig()).toEqual({
      tools: { profile: "full" },
      agents: {
        defaults: { model: "default-model" },
        list: [
          { id: "other-agent", tools: { profile: "minimal" } },
          { id: "new-agent", tools: { alsoAllow: ["web_search"], profile: "minimal" } },
        ],
      },
    });
    expect(toolsDirty.value).toBe(false);

    applyError = new Error("config apply failed");
    toolsDirty.value = true;
    await saveToolsConfig();

    expect(sendCalls.at(-1)?.method).toBe("config.apply");
    expect(toolsDirty.value).toBe(true);
    expect(toolsSaving.value).toBe(false);
    expect(errorToasts).toEqual(["config apply failed"]);
  });

  test("saveToolsConfig drops exact allowlists when saving profile-based overrides", async () => {
    gatewayConfig.value = {
      agents: {
        list: [
          {
            id: "agent-1",
            tools: { allow: ["read"], profile: "minimal" },
          },
        ],
      },
    };
    localToolsConfig.value = { alsoAllow: ["web_search"], deny: [], profile: "coding" };
    toolsDirty.value = true;

    await saveToolsConfig();

    const tools = parseAppliedConfig().agents?.list?.[0]?.tools;
    expect(tools).toEqual({ alsoAllow: ["web_search"], profile: "coding" });
    expect("allow" in (tools ?? {})).toBe(false);
  });

  test("saveToolsConfig keeps dirty when local tools change during an in-flight save", async () => {
    gatewayConfig.value = {
      agents: {
        list: [{ id: "agent-1", tools: { profile: "minimal" } }],
      },
    };
    localToolsConfig.value = { profile: "coding" };
    toolsDirty.value = true;
    let resolveApply!: () => void;
    const applyPromise = new Promise<void>((resolve) => {
      resolveApply = resolve;
    });
    sendResponder.value = async (method, params) => {
      sendCalls.push({ method, params });
      if (method === "config.apply") {
        await applyPromise;
        return {};
      }
      return configGetResult;
    };

    const saving = saveToolsConfig();
    toggleTool("exec", false);
    resolveApply();
    await saving;

    expect(toolsDirty.value).toBe(true);
    expect(localToolsConfig.value).toEqual({
      deny: ["exec"],
      profile: "coding",
      alsoAllow: [],
    });
  });

  test("saveToolsConfig clears dirty when in-flight edits return to the submitted tools", async () => {
    gatewayConfig.value = {
      agents: {
        list: [{ id: "agent-1", tools: { profile: "minimal" } }],
      },
    };
    localToolsConfig.value = { profile: "coding" };
    toolsDirty.value = true;
    let resolveApply!: () => void;
    const applyPromise = new Promise<void>((resolve) => {
      resolveApply = resolve;
    });
    sendResponder.value = async (method, params) => {
      sendCalls.push({ method, params });
      if (method === "config.apply") {
        await applyPromise;
        return {};
      }
      return configGetResult;
    };

    const saving = saveToolsConfig();
    toggleTool("exec", false);
    localToolsConfig.value = { profile: "coding" };
    resolveApply();
    await saving;

    expect(toolsDirty.value).toBe(false);
  });

  test("saveToolsConfig treats reordered tool lists as the submitted tools", async () => {
    gatewayConfig.value = {
      agents: {
        list: [{ id: "agent-1", tools: { profile: "minimal" } }],
      },
    };
    localToolsConfig.value = { deny: ["exec", "write"], profile: "coding" };
    toolsDirty.value = true;
    let resolveApply!: () => void;
    const applyPromise = new Promise<void>((resolve) => {
      resolveApply = resolve;
    });
    sendResponder.value = async (method, params) => {
      sendCalls.push({ method, params });
      if (method === "config.apply") {
        await applyPromise;
        return {};
      }
      return configGetResult;
    };

    const saving = saveToolsConfig();
    localToolsConfig.value = { deny: ["write", "exec"], profile: "coding" };
    resolveApply();
    await saving;

    expect(toolsDirty.value).toBe(false);
  });

  test("saveToolsConfig treats reordered tool object keys as the submitted tools", async () => {
    gatewayConfig.value = {
      agents: {
        list: [{ id: "agent-1", tools: { profile: "minimal" } }],
      },
    };
    localToolsConfig.value = { deny: ["exec"], profile: "coding" };
    toolsDirty.value = true;
    let resolveApply!: () => void;
    const applyPromise = new Promise<void>((resolve) => {
      resolveApply = resolve;
    });
    sendResponder.value = async (method, params) => {
      sendCalls.push({ method, params });
      if (method === "config.apply") {
        await applyPromise;
        return {};
      }
      return configGetResult;
    };

    const saving = saveToolsConfig();
    localToolsConfig.value = { profile: "coding", deny: ["exec"] };
    resolveApply();
    await saving;

    expect(toolsDirty.value).toBe(false);
  });

  test("saveSkillsAllowlist deletes inherited skills while preserving tools and model", async () => {
    gatewayConfig.value = {
      agents: {
        list: [
          {
            id: "agent-1",
            model: "agent-model",
            skills: ["old-skill"],
            tools: { alsoAllow: ["web_search"], profile: "coding" },
          },
        ],
      },
    };
    gatewayConfigHash.value = "hash-before";
    localSkillsAllowlist.value = null;
    agentSkillsAllowlist.value = ["old-skill"];
    skillsDirty.value = true;

    await saveSkillsAllowlist();

    expect(parseAppliedConfig()).toEqual({
      agents: {
        list: [
          {
            id: "agent-1",
            model: "agent-model",
            tools: { alsoAllow: ["web_search"], profile: "coding" },
          },
        ],
      },
    });
    expect(agentSkillsAllowlist.value).toBeNull();
    expect(skillsDirty.value).toBe(false);
    expect(skillsSaving.value).toBe(false);
    expect(successToasts).toEqual(["actions.saved"]);
  });

  test("saveSkillsAllowlist creates missing agents and preserves existing tool config", async () => {
    gatewayConfig.value = {
      agents: {
        list: [{ id: "other-agent", tools: { profile: "minimal" } }],
      },
    };
    selectedAgentId.value = "agent-1";
    localSkillsAllowlist.value = ["review", "deploy"];
    skillsDirty.value = true;

    await saveSkillsAllowlist();

    expect(parseAppliedConfig()).toEqual({
      agents: {
        list: [
          { id: "other-agent", tools: { profile: "minimal" } },
          { id: "agent-1", skills: ["review", "deploy"] },
        ],
      },
    });
    expect(agentSkillsAllowlist.value).toEqual(["review", "deploy"]);
    expect(skillsDirty.value).toBe(false);
  });

  test("saveSkillsAllowlist keeps dirty when allowlist changes during an in-flight save", async () => {
    gatewayConfig.value = {
      agents: {
        list: [{ id: "agent-1", skills: ["code-key"] }],
      },
    };
    localSkillsAllowlist.value = ["code-key"];
    skillsDirty.value = true;
    skills.value = [
      skillFixture({ name: "Code", skillKey: "code-key" }),
      skillFixture({ name: "Review", skillKey: "review-key" }),
    ];
    let resolveApply!: () => void;
    const applyPromise = new Promise<void>((resolve) => {
      resolveApply = resolve;
    });
    sendResponder.value = async (method, params) => {
      sendCalls.push({ method, params });
      if (method === "config.apply") {
        await applyPromise;
        return {};
      }
      return configGetResult;
    };

    const saving = saveSkillsAllowlist();
    toggleSkillInAllowlist("review-key");
    resolveApply();
    await saving;

    expect(agentSkillsAllowlist.value).toEqual(["code-key"]);
    expect(localSkillsAllowlist.value).toEqual(["code-key", "review-key"]);
    expect(skillsDirty.value).toBe(true);
  });

  test("saveSkillsAllowlist clears dirty when in-flight edits return to the submitted allowlist", async () => {
    gatewayConfig.value = {
      agents: {
        list: [{ id: "agent-1", skills: ["code-key"] }],
      },
    };
    localSkillsAllowlist.value = ["code-key"];
    skillsDirty.value = true;
    skills.value = [
      skillFixture({ name: "Code", skillKey: "code-key" }),
      skillFixture({ name: "Review", skillKey: "review-key" }),
    ];
    let resolveApply!: () => void;
    const applyPromise = new Promise<void>((resolve) => {
      resolveApply = resolve;
    });
    sendResponder.value = async (method, params) => {
      sendCalls.push({ method, params });
      if (method === "config.apply") {
        await applyPromise;
        return {};
      }
      return configGetResult;
    };

    const saving = saveSkillsAllowlist();
    toggleSkillInAllowlist("review-key");
    localSkillsAllowlist.value = ["code-key"];
    resolveApply();
    await saving;

    expect(skillsDirty.value).toBe(false);
  });

  test("saveSkillsAllowlist treats reordered allowlists as the submitted allowlist", async () => {
    gatewayConfig.value = {
      agents: {
        list: [{ id: "agent-1", skills: ["code-key", "review-key"] }],
      },
    };
    localSkillsAllowlist.value = ["code-key", "review-key"];
    skillsDirty.value = true;
    let resolveApply!: () => void;
    const applyPromise = new Promise<void>((resolve) => {
      resolveApply = resolve;
    });
    sendResponder.value = async (method, params) => {
      sendCalls.push({ method, params });
      if (method === "config.apply") {
        await applyPromise;
        return {};
      }
      return configGetResult;
    };

    const saving = saveSkillsAllowlist();
    localSkillsAllowlist.value = ["review-key", "code-key"];
    resolveApply();
    await saving;

    expect(skillsDirty.value).toBe(false);
  });

  test("skill allowlist actions derive eligible skill names and mark dirty", () => {
    skills.value = [
      skillFixture({ name: "Code", skillKey: "code-key" }),
      skillFixture({ disabled: true, name: "Disabled", skillKey: "disabled-key" }),
      skillFixture({ eligible: false, name: "Ineligible", skillKey: "ineligible-key" }),
      skillFixture({ name: "Review", skillKey: "review-key" }),
    ];
    syncSkillsAllowlist(null);

    toggleSkillInAllowlist("Code");
    expect(localSkillsAllowlist.value).toEqual(["review-key"]);
    expect(skillsDirty.value).toBe(true);

    clearSkillsAllowlist();
    expect(localSkillsAllowlist.value).toBeNull();

    disableAllSkills();
    expect(localSkillsAllowlist.value).toEqual([]);

    enableAllSkills();
    expect(localSkillsAllowlist.value).toEqual(["code-key", "review-key"]);
  });

  test("syncSkillsAllowlist normalizes legacy display names to skill keys", () => {
    skills.value = [
      skillFixture({ name: "Code", skillKey: "code-key" }),
      skillFixture({ name: "Review", skillKey: "review-key" }),
    ];
    skillsDirty.value = true;

    syncSkillsAllowlist(["Code", "review-key"]);

    expect(agentSkillsAllowlist.value).toEqual(["code-key", "review-key"]);
    expect(localSkillsAllowlist.value).toEqual(["code-key", "review-key"]);
    expect(skillsDirty.value).toBe(false);
  });

  test("loadSkills normalizes legacy display names after config syncs before skills load", async () => {
    syncSkillsAllowlist(["Code"]);
    expect(localSkillsAllowlist.value).toEqual(["Code"]);
    sendResponder.value = async (method, params) => {
      sendCalls.push({ method, params });
      if (method === "skills.status") {
        return {
          skills: [
            skillFixture({ name: "Code", skillKey: "code-key" }),
            skillFixture({ name: "Review", skillKey: "review-key" }),
          ],
        };
      }
      return defaultSendResponder(method, params);
    };

    await loadSkills();

    expect(agentSkillsAllowlist.value).toEqual(["code-key"]);
    expect(localSkillsAllowlist.value).toEqual(["code-key"]);
  });
});

function parseAppliedConfig(): GatewayConfig {
  const applyCall = sendCalls.find((call) => call.method === "config.apply");
  if (!applyCall) {
    throw new Error("Expected config.apply call");
  }
  return JSON.parse((applyCall.params as { raw: string }).raw) as GatewayConfig;
}

type SendResponder = (method: string, params: unknown) => Promise<unknown>;

const defaultSendResponder: SendResponder = async (method: string, params: unknown) => {
  sendCalls.push({ method, params });
  if (method === "config.apply") {
    if (applyError) throw applyError;
    return {};
  }
  if (method === "config.get") {
    return configGetResult;
  }
  if (method === "skills.status") {
    return { skills: [] };
  }
  throw new Error(`Unexpected gateway method ${method}`);
};

const sendResponder = {
  value: defaultSendResponder,
};

function skillFixture(overrides: {
  disabled?: boolean;
  eligible?: boolean;
  name: string;
  skillKey: string;
}) {
  return {
    always: false,
    baseDir: `/skills/${overrides.skillKey}`,
    blockedByAllowlist: false,
    configChecks: [],
    description: `${overrides.name} description`,
    disabled: overrides.disabled ?? false,
    eligible: overrides.eligible ?? true,
    filePath: `/skills/${overrides.skillKey}/SKILL.md`,
    install: [],
    missing: { anyBins: [], bins: [], config: [], env: [], os: [] },
    name: overrides.name,
    requirements: { anyBins: [], bins: [], config: [], env: [], os: [] },
    skillKey: overrides.skillKey,
    source: "core",
  };
}
