import { signal } from "@preact/signals";
import { send } from "@/lib/gateway";
import { getErrorMessage } from "@/lib/session-utils";
import { toast } from "@/components/ui/Toast";
import { t } from "@/lib/i18n";
import { selectedAgentId } from "./agents-core-state";

export const TOOL_PROFILES = ["full", "coding", "messaging", "minimal"] as const;
export type ToolProfile = (typeof TOOL_PROFILES)[number];

export interface ToolsConfig {
  profile?: ToolProfile;
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

export const gatewayConfig = signal<GatewayConfig | null>(null);
export const toolsLoading = signal<boolean>(false);
export const toolsSaving = signal<boolean>(false);
export const toolsDirty = signal<boolean>(false);
export const localToolsConfig = signal<ToolsConfig>({});

export function isToolProfile(value: string): value is ToolProfile {
  return TOOL_PROFILES.includes(value as ToolProfile);
}

export function normalizeToolProfile(value: string | undefined): ToolProfile {
  return value && isToolProfile(value) ? value : "full";
}

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

export function updateToolProfile(profile: ToolProfile): void {
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
