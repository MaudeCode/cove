import type { GatewayConfig, ToolsConfig } from "./agents-tools-state";
import type { GatewayRpcMap } from "../../types/gateway-rpc";

type ConfigApplyParams = GatewayRpcMap["config.apply"]["params"];
type ConfigGetResult = GatewayRpcMap["config.get"]["result"];

export interface AppliedGatewayConfig {
  config: GatewayConfig;
  hash: string | null;
}

export interface ConfigApplySender {
  (method: "config.apply", params: ConfigApplyParams): Promise<unknown>;
  (method: "config.get", params: Record<string, never>): Promise<ConfigGetResult>;
}

export const TOOL_PROFILES = ["full", "coding", "messaging", "minimal"] as const;
export type ToolProfile = (typeof TOOL_PROFILES)[number];

export function isToolProfile(value: string): value is ToolProfile {
  return (TOOL_PROFILES as readonly string[]).includes(value);
}

export function normalizeToolProfile(value: string | undefined): ToolProfile {
  return value && isToolProfile(value) ? value : "full";
}

export function normalizeGatewayConfig(config: GatewayConfig): GatewayConfig {
  return {
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
}

export function buildConfigApplyParams(
  config: GatewayConfig,
  baseHash: string | null,
  sessionKey?: string | null,
): {
  raw: string;
  baseHash?: string;
  sessionKey?: string;
} {
  return {
    raw: JSON.stringify(config),
    ...(baseHash ? { baseHash } : {}),
    ...(sessionKey ? { sessionKey } : {}),
  };
}

export async function applyGatewayConfigWithSend(
  config: GatewayConfig,
  baseHash: string | null,
  sessionKey: string | null,
  sendConfig: ConfigApplySender,
): Promise<AppliedGatewayConfig> {
  await sendConfig("config.apply", buildConfigApplyParams(config, baseHash, sessionKey));

  const refreshed = await sendConfig("config.get", {});
  return {
    config: normalizeGatewayConfig(refreshed.config as GatewayConfig),
    hash: refreshed.hash ?? null,
  };
}

export function buildAgentToolsConfig(
  config: GatewayConfig,
  agentId: string,
  toolsUpdate: ToolsConfig,
): GatewayConfig {
  const nextConfig = { ...config };
  const agentList = [...(nextConfig.agents?.list ?? [])];
  const agentIndex = agentList.findIndex((a) => a.id === agentId);

  if (agentIndex >= 0) {
    agentList[agentIndex] = { ...agentList[agentIndex], tools: toolsUpdate };
  } else {
    agentList.push({ id: agentId, tools: toolsUpdate });
  }

  nextConfig.agents = { ...nextConfig.agents, list: agentList };
  return nextConfig;
}

export function buildAgentSkillsConfig(
  config: GatewayConfig,
  agentId: string,
  skillsUpdate: string[] | null,
): GatewayConfig {
  const nextConfig = { ...config };
  const agentList = [...(nextConfig.agents?.list ?? [])];
  const agentIndex = agentList.findIndex((a) => a.id === agentId);

  if (agentIndex >= 0) {
    agentList[agentIndex] = { ...agentList[agentIndex], skills: skillsUpdate ?? undefined };
    if (skillsUpdate === null) {
      delete agentList[agentIndex].skills;
    }
  } else if (skillsUpdate !== null) {
    agentList.push({ id: agentId, skills: skillsUpdate });
  }

  nextConfig.agents = { ...nextConfig.agents, list: agentList };
  return nextConfig;
}
