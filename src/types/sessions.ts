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

  /** Model being used */
  model?: string;

  /** When the session was last updated (ms since epoch) */
  updatedAt?: number;

  /** Alias for updatedAt for convenience */
  lastActiveAt?: number;

  /** Context tokens available */
  contextTokens?: number;

  /** Total tokens used */
  totalTokens?: number;

  /** Transcript file path */
  transcriptPath?: string;

  /** Delivery context info */
  deliveryContext?: {
    channel?: string;
    to?: string;
    accountId?: string;
  };

  /** Last messages (when requested) */
  messages?: Array<{
    role: string;
    content: unknown;
  }>;
}

export interface SessionsListResult {
  /** Number of sessions */
  count: number;

  /** Session list */
  sessions: Session[];
}

export interface SessionsListParams {
  /** Filter by session kinds */
  kinds?: string[];

  /** Only sessions active in the last N minutes */
  activeMinutes?: number;

  /** Maximum number of sessions to return */
  limit?: number;

  /** Number of last messages to include per session */
  messageLimit?: number;
}
