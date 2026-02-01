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
