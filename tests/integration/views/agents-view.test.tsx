/** @jsxImportSource preact */
import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { fireEvent, renderComponent, screen, waitFor } from "../../helpers/dom";
import { integrationGatewayMock, setIntegrationGatewaySend } from "../../helpers/gateway";

type SendCall = {
  method: string;
  params: unknown;
};

const sendCalls: SendCall[] = [];
let agentsListResult: {
  agents: Array<{
    id: string;
    identity?: { emoji?: string; name?: string };
    name?: string;
    workspace?: string;
  }>;
  defaultId: string;
  mainKey: string;
  scope: "global" | "per-sender";
};

mock.module("@/lib/gateway", () => ({
  isConnected: integrationGatewayMock.isConnected,
  mainSessionKey: integrationGatewayMock.mainSessionKey,
  send: (method: string, params?: unknown) => integrationGatewayMock.send(method, params),
}));

mock.module("@/lib/i18n", () => ({
  formatBytes: (value: number) => `${value} B`,
  formatTimestampCompact: (value: number) => String(value),
  formatTokens: (value: number) => String(value),
  t: (key: string) => key,
}));

mock.module("@/lib/session-utils", () => ({
  getErrorMessage: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));

mock.module("@/components/ui/Toast", () => ({
  toast: {
    error: () => "error-toast",
    success: () => "success-toast",
  },
}));

mock.module("@/components/ui/Badge", () => import("../../../src/components/ui/Badge"));
mock.module("@/components/ui/Button", () => import("../../../src/components/ui/Button"));
mock.module("@/components/ui/Card", () => import("../../../src/components/ui/Card"));
mock.module("@/components/ui/Checkbox", () => import("../../../src/components/ui/Checkbox"));
mock.module("@/components/ui/Dropdown", () => import("../../../src/components/ui/Dropdown"));
mock.module("@/components/ui/HintBox", () => import("../../../src/components/ui/HintBox"));
mock.module("@/components/ui/IconButton", () => import("../../../src/components/ui/IconButton"));
mock.module("@/components/ui/Input", () => import("../../../src/components/ui/Input"));
mock.module("@/components/ui/Modal", () => import("../../../src/components/ui/Modal"));
mock.module("@/components/ui/PageHeader", () => import("../../../src/components/ui/PageHeader"));
mock.module("@/components/ui/PageLayout", () => import("../../../src/components/ui/PageLayout"));
mock.module("@/components/ui/Spinner", () => import("../../../src/components/ui/Spinner"));
mock.module("@/components/ui/TabNav", () => import("../../../src/components/ui/TabNav"));
mock.module("@/components/ui/Toggle", () => import("../../../src/components/ui/Toggle"));
mock.module(
  "@/components/ui/ViewErrorBoundary",
  () => import("../../../src/components/ui/ViewErrorBoundary"),
);
mock.module(
  "@/components/agents/AgentAvatar",
  () => import("../../../src/components/agents/AgentAvatar"),
);
mock.module("@/hooks/useClickOutside", () => import("../../../src/hooks/useClickOutside"));
mock.module("@/hooks/useFocusTrap", () => import("../../../src/hooks/useFocusTrap"));
mock.module("@/hooks/useQueryParam", () => import("../../../src/hooks/useQueryParam"));
mock.module("@/lib/logger", () => import("../../../src/lib/logger"));
mock.module("@/types/workspace", () => import("../../../src/types/workspace"));

const { activeTab, agentSelectorOpen, agents, files, isLoading, selectedAgentId } =
  await import("../../../src/views/agents/agents-core-state");
const { localSkillsAllowlist, skills, skillsDirty, skillsSearchQuery } =
  await import("../../../src/views/agents/agents-skills-state");
const { gatewayConfig } = await import("../../../src/views/agents/agents-tools-state");
const { AgentSelector } = await import("../../../src/views/agents/AgentSelector");
const { AgentsView } = await import("../../../src/views/agents/AgentsView");
const { SkillsTab } = await import("../../../src/views/agents/tabs/SkillsTab");

describe("AgentsView URL and selector state", () => {
  afterAll(() => {
    mock.restore();
  });

  beforeEach(() => {
    sendCalls.length = 0;
    sendResponder.value = defaultSendResponder;
    setIntegrationGatewaySend(sendResponder.value);
    agentsListResult = {
      agents: [
        { id: "main", name: "Main", workspace: "/main" },
        { id: "agent-2", name: "Agent Two", workspace: "/agent-2" },
      ],
      defaultId: "main",
      mainKey: "main",
      scope: "global",
    };

    activeTab.value = "overview";
    agentSelectorOpen.value = false;
    agents.value = [];
    files.value = [];
    gatewayConfig.value = null;
    integrationGatewayMock.isConnected.value = false;
    integrationGatewayMock.mainSessionKey.value = "main";
    isLoading.value = false;
    selectedAgentId.value = "main";
    skills.value = [];
    skillsDirty.value = false;
    skillsSearchQuery.value = "";
    localSkillsAllowlist.value = null;
    window.history.replaceState(null, "", "/agents");
  });

  test("loads skills, selected agent, and skills search from URL", async () => {
    window.history.replaceState(null, "", "/agents?tab=skills&q=code&agent=agent-2");
    integrationGatewayMock.isConnected.value = true;

    renderComponent(<AgentsView />);

    await waitFor(() => {
      expect(sendCalls.some((call) => call.method === "skills.status")).toBe(true);
      expect(selectedAgentId.value).toBe("agent-2");
    });

    expect(activeTab.value).toBe("skills");
    expect(skillsSearchQuery.value).toBe("code");
    expect(screen.getByLabelText("common.searchSkills")).toHaveProperty("value", "code");
    expect(window.location.search).toContain("q=code");
    expect(sendCalls.filter((call) => call.method === "skills.status")).toHaveLength(1);
  });

  test("clears q outside the skills tab and does not leak it back into skills", async () => {
    window.history.replaceState(null, "", "/agents?tab=overview&q=code");
    integrationGatewayMock.isConnected.value = true;

    renderComponent(<AgentsView />);

    await waitFor(() => {
      expect(window.location.search).not.toContain("q=code");
    });
    expect(skillsSearchQuery.value).toBe("");

    fireEvent.click(screen.getByRole("tab", { name: "common.skills" }));

    await waitFor(() => {
      expect(activeTab.value).toBe("skills");
      expect(screen.getByLabelText("common.searchSkills")).toHaveProperty("value", "");
    });
    expect(window.location.search).not.toContain("q=code");

    const skillsLoadCount = sendCalls.filter((call) => call.method === "skills.status").length;
    fireEvent.click(screen.getByRole("tab", { name: "common.skills" }));
    await waitFor(() => {
      expect(sendCalls.filter((call) => call.method === "skills.status")).toHaveLength(
        skillsLoadCount,
      );
    });
  });

  test("responds to tab query changes after mount", async () => {
    integrationGatewayMock.isConnected.value = true;
    renderComponent(<AgentsView />);

    window.history.replaceState(null, "", "/agents?tab=skills");
    window.dispatchEvent(new Event("popstate"));

    await waitFor(() => {
      expect(activeTab.value).toBe("skills");
      expect(sendCalls.some((call) => call.method === "skills.status")).toBe(true);
    });
  });

  test("AgentSelector keeps distinct same-workspace agents and de-dupes duplicate ids", async () => {
    agents.value = [
      { id: "agent-a", name: "Agent A", workspace: "/same" },
      { id: "agent-b", name: "Agent B", workspace: "/same" },
      { id: "agent-b", name: "Agent B duplicate", workspace: "/same" },
    ];
    selectedAgentId.value = "agent-b";

    renderComponent(<AgentSelector />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));

    const options = screen.getAllByRole("option");
    expect(options.map((option: HTMLElement) => option.textContent)).toEqual([
      "🤖Agent Aagent-a",
      "🤖Agent Bagent-b",
    ]);
    expect(
      options.some((option: HTMLElement) => option.getAttribute("aria-selected") === "true"),
    ).toBe(true);
  });

  test("SkillsTab renders key-based allowlist entries as enabled and toggles by skill key", () => {
    skills.value = [skillFixture({ name: "Code", skillKey: "code-key" })];
    localSkillsAllowlist.value = ["code-key"];

    renderComponent(<SkillsTab />);

    const toggle = screen.getByRole("switch");
    expect(toggle.getAttribute("aria-checked")).toBe("true");

    fireEvent.click(toggle);

    expect(localSkillsAllowlist.value).toEqual([]);
    expect(skillsDirty.value).toBe(true);
  });
});

type SendResponder = (method: string, params: unknown) => Promise<unknown>;

const defaultSendResponder: SendResponder = async (method: string, params: unknown) => {
  sendCalls.push({ method, params });
  if (method === "agents.list") return agentsListResult;
  if (method === "agents.files.list") return { files: [], workspace: "/workspace" };
  if (method === "config.get") {
    return {
      config: {
        agents: {
          list: [
            { id: "main", skills: ["code-key"], tools: { profile: "coding" } },
            { id: "agent-2", skills: ["code-key"], tools: { profile: "minimal" } },
          ],
        },
      },
      exists: true,
      hash: "hash",
      raw: "{}",
      valid: true,
    };
  }
  if (method === "skills.status") {
    return {
      skills: [skillFixture({ name: "Code", skillKey: "code-key" })],
    };
  }
  throw new Error(`Unexpected gateway method ${method}`);
};

const sendResponder = {
  value: defaultSendResponder,
};

function skillFixture(overrides: { name: string; skillKey: string }) {
  return {
    always: false,
    baseDir: `/skills/${overrides.skillKey}`,
    blockedByAllowlist: false,
    configChecks: [],
    description: `${overrides.name} description`,
    disabled: false,
    eligible: true,
    filePath: `/skills/${overrides.skillKey}/SKILL.md`,
    install: [],
    missing: { anyBins: [], bins: [], config: [], env: [], os: [] },
    name: overrides.name,
    requirements: { anyBins: [], bins: [], config: [], env: [], os: [] },
    skillKey: overrides.skillKey,
    source: "core",
  };
}
