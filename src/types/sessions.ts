/**
 * Session Types
 *
 * Matches OpenClaw gateway sessions.list response.
 */

export interface Session {
  /** Session key (unique identifier, e.g. "agent:main:main") */
  key: string;

  /** Session ID (UUID) */
  sessionId?: string;

  /** Session kind */
  kind?: "main" | "isolated" | "channel" | "group" | "other";

  /** Display name */
  displayName?: string;

  /** Custom label (user-set) */
  label?: string;

  /** Channel (telegram, discord, webchat, etc.) */
  channel?: string;

  /** Last channel used */
  lastChannel?: string;

  /** Channel target metadata from the last routed turn */
  lastTo?: string | number;
  lastAccountId?: string;
  lastThreadId?: string | number;

  /** Model being used */
  model?: string;
  modelProvider?: string;

  /** When the session was last updated (ms since epoch) */
  updatedAt?: number;

  /** Alias for updatedAt for convenience */
  lastActiveAt?: number;

  /** Context tokens available */
  contextTokens?: number;

  /** Total tokens used */
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokensFresh?: boolean;
  estimatedCostUsd?: number;
  responseUsage?: "off" | "tokens" | "full" | "on";

  /** Transcript file path */
  transcriptPath?: string;

  /** Delivery context info */
  deliveryContext?: {
    channel?: string;
    to?: string;
    accountId?: string;
    threadId?: string | number;
  };

  /** Last messages (when requested) */
  messages?: Array<{
    role: string;
    content: unknown;
  }>;

  /** Thinking level override */
  thinkingLevel?: string | null;
  thinking?: string;

  /** Verbose level override */
  verboseLevel?: string | null;
  verbose?: string;

  /** Trace level override */
  traceLevel?: string | null;

  /** Reasoning level override */
  reasoningLevel?: string | null;
  reasoning?: string;

  /** Runtime/session lifecycle metadata */
  status?: string;
  hasActiveRun?: boolean;
  startedAt?: number;
  endedAt?: number;
  runtimeMs?: number;
  spawnedBy?: string;
  spawnedWorkspaceDir?: string;
  forkedFromParent?: boolean;
  spawnDepth?: number;
  subagentRole?: "orchestrator" | "leaf";
  subagentControlScope?: "children" | "none";
  parentSessionKey?: string;
  childSessions?: string[];
  sendPolicy?: "allow" | "deny";
  groupActivation?: "mention" | "always";
  systemSent?: boolean;
  abortedLastRun?: boolean;
  compactionCheckpointCount?: number;
  latestCompactionCheckpoint?: unknown;
  pluginExtensions?: Record<string, unknown>;
}

export interface SessionsListResult {
  /** Number of sessions */
  count: number;

  /** Session list */
  sessions: Session[];
}

export interface SessionsListParams {
  /** Only sessions active in the last N minutes */
  activeMinutes?: number;

  /** Maximum number of sessions to return */
  limit?: number;

  /** Offset for paginated session lists */
  offset?: number;

  includeGlobal?: boolean;
  includeUnknown?: boolean;
  configuredAgentsOnly?: boolean;
  includeDerivedTitles?: boolean;
  includeLastMessage?: boolean;
  label?: string;
  spawnedBy?: string;
  agentId?: string;
  search?: string;
}
