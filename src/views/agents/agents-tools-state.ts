import { signal } from "@preact/signals";
import { mainSessionKey, send } from "@/lib/gateway";
import { getErrorMessage } from "@/lib/session-utils";
import { toast } from "@/components/ui/Toast";
import { t } from "@/lib/i18n";
import { selectedAgentId } from "./agents-core-state";
import {
  buildAgentToolsConfig,
  applyGatewayConfigWithSend,
  type ToolProfile,
} from "./agents-config-utils";

export {
  isToolProfile,
  normalizeGatewayConfig,
  normalizeToolProfile,
  TOOL_PROFILES,
} from "./agents-config-utils";
export type { ToolProfile } from "./agents-config-utils";

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
export const gatewayConfigHash = signal<string | null>(null);
export const toolsLoading = signal<boolean>(false);
export const toolsSaving = signal<boolean>(false);
export const toolsDirty = signal<boolean>(false);
export const localToolsConfig = signal<ToolsConfig>({});

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

export async function applyGatewayConfig(config: GatewayConfig): Promise<GatewayConfig> {
  const refreshed = await applyGatewayConfigWithSend(
    config,
    gatewayConfigHash.value,
    mainSessionKey.value,
    send,
  );
  gatewayConfig.value = refreshed.config;
  gatewayConfigHash.value = refreshed.hash;

  return refreshed.config;
}

export async function saveToolsConfig(): Promise<void> {
  if (!gatewayConfig.value) return;

  toolsSaving.value = true;
  const submittedToolsConfig = localToolsConfig.value;
  try {
    const existingTools =
      gatewayConfig.value.agents?.list?.find((agent) => agent.id === selectedAgentId.value)
        ?.tools ?? {};
    const existingToolOverrides: ToolsConfig = { ...existingTools };
    delete existingToolOverrides.allow;
    const toolsUpdate: ToolsConfig = {
      ...existingToolOverrides,
      profile: submittedToolsConfig.profile,
      alsoAllow: submittedToolsConfig.alsoAllow?.length
        ? submittedToolsConfig.alsoAllow
        : undefined,
      deny: submittedToolsConfig.deny?.length ? submittedToolsConfig.deny : undefined,
    };
    const config = buildAgentToolsConfig(gatewayConfig.value, selectedAgentId.value, toolsUpdate);

    await applyGatewayConfig(config);
    if (toolsConfigsEqual(localToolsConfig.value, submittedToolsConfig)) {
      toolsDirty.value = false;
    }
    toast.success(t("actions.saved"));
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    toolsSaving.value = false;
  }
}

function toolsConfigsEqual(left: ToolsConfig, right: ToolsConfig): boolean {
  return (
    JSON.stringify(normalizeToolsConfigForCompare(left)) ===
    JSON.stringify(normalizeToolsConfigForCompare(right))
  );
}

function normalizeToolsConfigForCompare(config: ToolsConfig): ToolsConfig {
  return {
    profile: config.profile,
    allow: normalizeList(config.allow),
    alsoAllow: normalizeList(config.alsoAllow),
    deny: normalizeList(config.deny),
  };
}

function normalizeList(value: string[] | undefined): string[] | undefined {
  return value?.length ? [...value].sort() : undefined;
}
