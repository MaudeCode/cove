/**
 * Agent State
 *
 * Centralized state management for the Agents view.
 * All signals and actions for agent CRUD, tools, skills, and files.
 */

import { signal, computed } from "@preact/signals";
import { send } from "@/lib/gateway";
import { getErrorMessage } from "@/lib/session-utils";
import { toast } from "@/components/ui/Toast";
import { t } from "@/lib/i18n";
import { route } from "preact-router";
import type { WorkspaceFile, WorkspaceFilesResult } from "@/types/workspace";
import type { Agent, AgentsListResponse } from "@/types/agents";
import type { SkillStatusReport, SkillStatusEntry } from "@/types/skills";
import { formatAgentName } from "@/types/agents";

// ============================================
// Types
// ============================================

export type AgentsTab = "overview" | "files" | "tools" | "skills";

export interface ToolsConfig {
  profile?: string;
  allow?: string[];
  alsoAllow?: string[];
  deny?: string[];
}

export interface AgentEntry {
  id: string;
  tools?: ToolsConfig;
  skills?: string[];
  model?: string | { primary?: string; fallbacks?: string[] };
}

export interface GatewayConfig {
  tools?: ToolsConfig;
  agents?: {
    defaults?: {
      model?: string | { primary?: string; fallbacks?: string[] };
    };
    list?: AgentEntry[];
  };
}

// ============================================
// Core State
// ============================================

export const agents = signal<Agent[]>([]);
export const defaultAgentId = signal<string>("main");
export const selectedAgentId = signal<string>("main");
export const activeTab = signal<AgentsTab>("overview");
export const files = signal<WorkspaceFile[]>([]);
export const workspacePath = signal<string>("");
export const isLoading = signal<boolean>(false);
export const error = signal<string | null>(null);

// ============================================
// Tools State
// ============================================

export const gatewayConfig = signal<GatewayConfig | null>(null);
export const toolsLoading = signal<boolean>(false);
export const toolsSaving = signal<boolean>(false);
export const toolsDirty = signal<boolean>(false);
export const localToolsConfig = signal<ToolsConfig>({});

// ============================================
// Skills State
// ============================================

export const skills = signal<SkillStatusEntry[]>([]);
export const skillsLoading = signal<boolean>(false);
export const skillsSearchQuery = signal<string>("");
export const skillsSaving = signal<boolean>(false);
export const skillsDirty = signal<boolean>(false);
export const agentSkillsAllowlist = signal<string[] | null>(null);
export const localSkillsAllowlist = signal<string[] | null>(null);

// ============================================
// Overview Editing State
// ============================================

export const overviewEditing = signal<boolean>(false);
export const overviewSaving = signal<boolean>(false);
export const editName = signal<string>("");
export const editAvatar = signal<string>("");
export const editWorkspace = signal<string>("");
export const editModel = signal<string>("");

// ============================================
// Agent Selector State
// ============================================

export const agentSelectorOpen = signal<boolean>(false);

// ============================================
// Create Agent Modal State
// ============================================

export const createModalOpen = signal<boolean>(false);
export const createName = signal<string>("");
export const createWorkspace = signal<string>("");
export const createEmoji = signal<string>("");
export const createSaving = signal<boolean>(false);

// ============================================
// Delete Agent Modal State
// ============================================

export const deleteModalOpen = signal<boolean>(false);
export const deleteConfirmText = signal<string>("");
export const deleteIncludeFiles = signal<boolean>(false);
export const deleteDeleting = signal<boolean>(false);

// ============================================
// Computed
// ============================================

export const uniqueAgents = computed(() => {
  const seen = new Set<string>();
  return agents.value.filter((agent) => {
    const key = agent.workspace || formatAgentName(agent);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
});

export const selectedAgent = computed(() => {
  return agents.value.find((a) => a.id === selectedAgentId.value) ?? null;
});

// ============================================
// Helpers
// ============================================

export function extractPrimaryModel(
  model: string | { primary?: string } | undefined,
): string | undefined {
  if (!model) return undefined;
  if (typeof model === "string") return model;
  return model.primary;
}

export function getAgentModel(agentId: string): string | undefined {
  const config = gatewayConfig.value;
  if (!config) return undefined;

  const agentEntry = config.agents?.list?.find((a) => a.id === agentId);
  const agentModel = extractPrimaryModel(agentEntry?.model);
  if (agentModel) return agentModel;

  return extractPrimaryModel(config.agents?.defaults?.model);
}

// ============================================
// Actions - Loading
// ============================================

export async function loadAgents(): Promise<void> {
  try {
    const result = await send<AgentsListResponse>("agents.list", {});
    agents.value = result.agents;
    defaultAgentId.value = result.defaultId;
    if (!result.agents.find((a) => a.id === selectedAgentId.value)) {
      selectedAgentId.value = result.defaultId || result.agents[0]?.id || "main";
    }
  } catch {
    agents.value = [{ id: "main", name: "Main" }];
  }
}

export async function loadFiles(): Promise<void> {
  isLoading.value = true;
  error.value = null;

  try {
    const result = await send<WorkspaceFilesResult>("agents.files.list", {
      agentId: selectedAgentId.value,
    });
    files.value = result.files;
    workspacePath.value = result.workspace;
  } catch (err) {
    error.value = getErrorMessage(err);
    toast.error(t("agents.files.loadError"));
  } finally {
    isLoading.value = false;
  }
}

export async function loadToolsConfig(): Promise<void> {
  toolsLoading.value = true;
  try {
    const result = await send<{ config: GatewayConfig }>("config.get", {});
    gatewayConfig.value = result.config;

    const agentEntry = result.config.agents?.list?.find((a) => a.id === selectedAgentId.value);
    localToolsConfig.value = {
      profile: agentEntry?.tools?.profile ?? result.config.tools?.profile ?? "full",
      alsoAllow: agentEntry?.tools?.alsoAllow ?? [],
      deny: agentEntry?.tools?.deny ?? [],
    };
    toolsDirty.value = false;

    const allowlist = agentEntry?.skills ?? null;
    agentSkillsAllowlist.value = allowlist;
    localSkillsAllowlist.value = allowlist ? [...allowlist] : null;
    skillsDirty.value = false;
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    toolsLoading.value = false;
  }
}

export async function loadSkills(): Promise<void> {
  skillsLoading.value = true;
  try {
    const result = await send<SkillStatusReport>("skills.status", {});
    skills.value = result.skills;
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    skillsLoading.value = false;
  }
}

// ============================================
// Actions - Tools
// ============================================

export function isToolEnabled(toolId: string): boolean {
  const config = localToolsConfig.value;
  const profile = config.profile ?? "full";
  const alsoAllow = config.alsoAllow ?? [];
  const deny = config.deny ?? [];

  if (deny.includes(toolId)) return false;
  if (alsoAllow.includes(toolId)) return true;

  if (profile === "full") return true;
  if (profile === "minimal") return ["read", "memory_search", "memory_get"].includes(toolId);
  if (profile === "coding")
    return ["read", "write", "edit", "exec", "process", "web_search", "web_fetch"].includes(toolId);
  if (profile === "messaging")
    return ["read", "message", "sessions_list", "sessions_send"].includes(toolId);

  return false;
}

export function updateToolProfile(profile: string): void {
  localToolsConfig.value = { ...localToolsConfig.value, profile };
  toolsDirty.value = true;
}

export function toggleTool(toolId: string, enabled: boolean): void {
  const config = { ...localToolsConfig.value };
  const alsoAllow = new Set(config.alsoAllow ?? []);
  const deny = new Set(config.deny ?? []);

  if (enabled) {
    deny.delete(toolId);
    const profile = config.profile ?? "full";
    if (profile !== "full") {
      alsoAllow.add(toolId);
    }
  } else {
    alsoAllow.delete(toolId);
    deny.add(toolId);
  }

  localToolsConfig.value = {
    ...config,
    alsoAllow: [...alsoAllow],
    deny: [...deny],
  };
  toolsDirty.value = true;
}

export async function saveToolsConfig(): Promise<void> {
  if (!gatewayConfig.value) return;

  toolsSaving.value = true;
  try {
    const config = { ...gatewayConfig.value };
    const agentList = [...(config.agents?.list ?? [])];
    const agentIndex = agentList.findIndex((a) => a.id === selectedAgentId.value);

    const toolsUpdate: ToolsConfig = {
      profile: localToolsConfig.value.profile,
      alsoAllow: localToolsConfig.value.alsoAllow?.length
        ? localToolsConfig.value.alsoAllow
        : undefined,
      deny: localToolsConfig.value.deny?.length ? localToolsConfig.value.deny : undefined,
    };

    if (agentIndex >= 0) {
      agentList[agentIndex] = { ...agentList[agentIndex], tools: toolsUpdate };
    } else {
      agentList.push({ id: selectedAgentId.value, tools: toolsUpdate });
    }

    config.agents = { ...config.agents, list: agentList };

    await send("config.apply", { config });
    gatewayConfig.value = config;
    toolsDirty.value = false;
    toast.success(t("actions.saved"));
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    toolsSaving.value = false;
  }
}

// ============================================
// Actions - Skills
// ============================================

export function toggleSkillInAllowlist(skillName: string): void {
  const current = localSkillsAllowlist.value;

  if (current === null) {
    const allSkillNames = skills.value.filter((s) => !s.disabled && s.eligible).map((s) => s.name);
    localSkillsAllowlist.value = allSkillNames.filter((n) => n !== skillName);
  } else if (current.includes(skillName)) {
    localSkillsAllowlist.value = current.filter((n) => n !== skillName);
  } else {
    localSkillsAllowlist.value = [...current, skillName];
  }
  skillsDirty.value = true;
}

export function clearSkillsAllowlist(): void {
  localSkillsAllowlist.value = null;
  skillsDirty.value = true;
}

export function disableAllSkills(): void {
  localSkillsAllowlist.value = [];
  skillsDirty.value = true;
}

export function enableAllSkills(): void {
  const allSkillNames = skills.value.filter((s) => !s.disabled && s.eligible).map((s) => s.name);
  localSkillsAllowlist.value = allSkillNames;
  skillsDirty.value = true;
}

export async function saveSkillsAllowlist(): Promise<void> {
  if (!gatewayConfig.value) return;

  skillsSaving.value = true;
  try {
    const config = { ...gatewayConfig.value };
    const agentList = [...(config.agents?.list ?? [])];
    const agentIndex = agentList.findIndex((a) => a.id === selectedAgentId.value);

    const skillsUpdate = localSkillsAllowlist.value;

    if (agentIndex >= 0) {
      agentList[agentIndex] = { ...agentList[agentIndex], skills: skillsUpdate ?? undefined };
      if (skillsUpdate === null) {
        delete agentList[agentIndex].skills;
      }
    } else if (skillsUpdate !== null) {
      agentList.push({ id: selectedAgentId.value, skills: skillsUpdate });
    }

    config.agents = { ...config.agents, list: agentList };

    await send("config.apply", { config });
    gatewayConfig.value = config;
    agentSkillsAllowlist.value = localSkillsAllowlist.value;
    skillsDirty.value = false;
    toast.success(t("actions.saved"));
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    skillsSaving.value = false;
  }
}

// ============================================
// Actions - Overview Edit
// ============================================

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
    const params: Record<string, string> = { agentId: agent.id };

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

// ============================================
// Actions - Create Agent
// ============================================

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
    const params: Record<string, string> = { name, workspace };
    if (createEmoji.value.trim()) {
      params.emoji = createEmoji.value.trim();
    }

    const result = await send<{ ok: boolean; agentId: string }>("agents.create", params);
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

// ============================================
// Actions - Delete Agent
// ============================================

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

// ============================================
// Actions - Navigation
// ============================================

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
