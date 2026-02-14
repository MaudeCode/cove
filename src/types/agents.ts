/**
 * Agent Types
 *
 * Types for OpenClaw agent configuration and identity.
 */

// ============================================
// Identity
// ============================================

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

// ============================================
// Agent List
// ============================================

/**
 * Agent entry from agents.list API
 */
export interface Agent {
  id: string;
  name?: string;
  identity?: AgentIdentity;
  workspace?: string;
}

/**
 * Response from agents.list gateway method
 */
export interface AgentsListResponse {
  defaultId: string;
  mainKey: string;
  scope: "per-sender" | "global";
  agents: Agent[];
}

// ============================================
// Helpers
// ============================================

/**
 * Get display name for an agent
 */
export function getAgentDisplayName(agent: Agent): string {
  return agent.identity?.name || agent.name || agent.id;
}

/**
 * Format agent name with emoji prefix
 */
export function formatAgentName(agent: Agent): string {
  const name = getAgentDisplayName(agent);
  const emoji = agent.identity?.emoji;
  return emoji ? `${emoji}\u00A0\u00A0${name}` : name;
}
