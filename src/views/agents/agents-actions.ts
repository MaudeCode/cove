import { route } from "preact-router";
import { send } from "@/lib/gateway";
import { getErrorMessage } from "@/lib/session-utils";
import { toast } from "@/components/ui/Toast";
import { t } from "@/lib/i18n";
import {
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
  loadAgents,
  loadFiles,
  overviewEditing,
  overviewSaving,
  selectedAgent,
  selectedAgentId,
  workspacePath,
} from "./agents-core-state";
import type { AgentsTab } from "./agents-core-state";
import {
  gatewayConfig,
  getAgentModel,
  localToolsConfig,
  normalizeToolProfile,
  toolsDirty,
  toolsLoading,
} from "./agents-tools-state";
import { loadSkills, skills, syncSkillsAllowlist } from "./agents-skills-state";
import type { GatewayConfig } from "./agents-tools-state";

export async function loadToolsConfig(): Promise<void> {
  toolsLoading.value = true;
  try {
    const result = await send("config.get", {});
    const config = result.config;
    const normalizedConfig: GatewayConfig = {
      ...config,
      tools: config.tools
        ? {
            ...config.tools,
            profile: normalizeToolProfile(config.tools.profile),
          }
        : undefined,
      agents: config.agents
        ? {
            ...config.agents,
            list: config.agents.list?.map((agent) => ({
              ...agent,
              tools: agent.tools
                ? {
                    ...agent.tools,
                    profile: normalizeToolProfile(agent.tools.profile),
                  }
                : undefined,
            })),
          }
        : undefined,
    };
    gatewayConfig.value = normalizedConfig;

    const agentEntry = normalizedConfig.agents?.list?.find((a) => a.id === selectedAgentId.value);
    localToolsConfig.value = {
      profile: normalizeToolProfile(agentEntry?.tools?.profile ?? normalizedConfig.tools?.profile),
      alsoAllow: agentEntry?.tools?.alsoAllow ?? [],
      deny: agentEntry?.tools?.deny ?? [],
    };
    toolsDirty.value = false;

    syncSkillsAllowlist(agentEntry?.skills ?? null);
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    toolsLoading.value = false;
  }
}

export async function startOverviewEdit(): Promise<void> {
  const agent = selectedAgent.value;
  if (!agent) return;

  if (!gatewayConfig.value) {
    await loadToolsConfig();
  }

  editName.value = agent.identity?.name || agent.name || "";
  editAvatar.value = agent.identity?.avatar || "";
  editWorkspace.value = workspacePath.value || "";
  editModel.value = getAgentModel(agent.id) || "";
  overviewEditing.value = true;
}

export function cancelOverviewEdit(): void {
  overviewEditing.value = false;
  editName.value = "";
  editAvatar.value = "";
  editWorkspace.value = "";
  editModel.value = "";
}

export async function saveOverviewEdit(): Promise<void> {
  const agent = selectedAgent.value;
  if (!agent) return;

  overviewSaving.value = true;
  try {
    const params: {
      agentId: string;
      name?: string;
      avatar?: string;
      workspace?: string;
      model?: string;
    } = { agentId: agent.id };

    const newName = editName.value.trim();
    const oldName = agent.identity?.name || agent.name || "";
    if (newName && newName !== oldName) {
      params.name = newName;
    }

    const newAvatar = editAvatar.value.trim();
    const oldAvatar = agent.identity?.avatar || "";
    if (newAvatar !== oldAvatar) {
      params.avatar = newAvatar;
    }

    const newWorkspace = editWorkspace.value.trim();
    const oldWorkspace = workspacePath.value || "";
    if (newWorkspace && newWorkspace !== oldWorkspace) {
      params.workspace = newWorkspace;
    }

    const newModel = editModel.value.trim();
    const oldModel = getAgentModel(agent.id) || "";
    if (newModel && newModel !== oldModel) {
      params.model = newModel;
    }

    if (params.name || params.avatar !== undefined || params.workspace || params.model) {
      await send("agents.update", params);
      await loadAgents();
      await loadFiles();
      toast.success(t("actions.saved"));
    }

    overviewEditing.value = false;
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    overviewSaving.value = false;
  }
}

export function openCreateModal(): void {
  createName.value = "";
  createWorkspace.value = "";
  createEmoji.value = "";
  createModalOpen.value = true;
}

export async function createAgent(): Promise<void> {
  const name = createName.value.trim();
  const workspace = createWorkspace.value.trim();

  if (!name || !workspace) {
    toast.error(t("agents.create.requiredFields"));
    return;
  }

  createSaving.value = true;
  try {
    const params: { name: string; workspace: string; emoji?: string } = { name, workspace };
    if (createEmoji.value.trim()) {
      params.emoji = createEmoji.value.trim();
    }

    const result = await send("agents.create", params);
    if (result.ok) {
      await loadAgents();
      selectedAgentId.value = result.agentId;
      await loadFiles();
      await loadToolsConfig();
      toast.success(t("agents.create.success"));
      createModalOpen.value = false;
    }
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    createSaving.value = false;
  }
}

export function openDeleteModal(): void {
  deleteConfirmText.value = "";
  deleteIncludeFiles.value = false;
  deleteModalOpen.value = true;
}

export async function deleteAgent(): Promise<void> {
  const agent = selectedAgent.value;
  if (!agent) return;

  if (deleteConfirmText.value !== agent.id) {
    toast.error(t("agents.delete.confirmMismatch"));
    return;
  }

  deleteDeleting.value = true;
  try {
    await send("agents.delete", {
      agentId: agent.id,
      deleteFiles: deleteIncludeFiles.value,
    });

    await loadAgents();
    const remaining = agents.value;
    if (remaining.length > 0) {
      selectedAgentId.value = remaining[0].id;
    } else {
      selectedAgentId.value = "main";
    }
    await loadFiles();
    await loadToolsConfig();

    toast.success(t("agents.delete.success"));
    deleteModalOpen.value = false;
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    deleteDeleting.value = false;
  }
}

export async function refresh(): Promise<void> {
  await loadAgents();
  await loadFiles();
  if (activeTab.value === "tools") {
    await loadToolsConfig();
  } else if (activeTab.value === "skills") {
    await loadToolsConfig();
    await loadSkills();
  }
}

export function selectAgent(agentId: string): void {
  selectedAgentId.value = agentId;
  loadFiles();
  if (activeTab.value === "tools" || activeTab.value === "skills") {
    loadToolsConfig();
  }
}

export function selectTab(tab: AgentsTab): void {
  activeTab.value = tab;
  if (tab === "overview" && !gatewayConfig.value) {
    loadToolsConfig();
  } else if (tab === "tools" && !gatewayConfig.value) {
    loadToolsConfig();
  } else if (tab === "skills") {
    if (skills.value.length === 0) {
      loadSkills();
    }
    if (!gatewayConfig.value) {
      loadToolsConfig();
    }
  }
}

export function openFile(filename: string): void {
  route(`/agents/edit/${encodeURIComponent(filename)}?agent=${selectedAgentId.value}`);
}
