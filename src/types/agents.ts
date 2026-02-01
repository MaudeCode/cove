/**
 * Agent Types
 *
 * Types for OpenClaw agent configuration and identity.
 */

/**
 * Agent identity information (name, theme, emoji, avatar)
 */
export interface AgentIdentity {
  name?: string;
  theme?: string;
  emoji?: string;
  avatar?: string;
  avatarUrl?: string;
}

/**
 * Agent entry from agents.list API
 */
export interface Agent {
  id: string;
  name?: string;
  identity?: AgentIdentity;
}

/**
 * Response from agents.list gateway method
 */
export interface AgentsListResponse {
  defaultId: string;
  mainKey: string;
  scope: string;
  agents: Agent[];
}

/**
 * Get display name for an agent (identity name > name > id)
 */
export function getAgentDisplayName(agent: Agent): string {
  return agent.identity?.name || agent.name || agent.id;
}

/**
 * Get emoji for an agent (falls back to generic icon)
 */
export function getAgentEmoji(agent: Agent): string {
  return agent.identity?.emoji || "🤖";
}
