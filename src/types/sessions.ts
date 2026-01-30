/**
 * Session Types
 */

export interface Session {
  /** Session key (unique identifier) */
  key: string;

  /** Session ID (internal) */
  sessionId?: string;

  /** Display label */
  label?: string;

  /** Channel (telegram, discord, webchat, etc.) */
  channel?: string;

  /** When the session was created */
  createdAt?: number;

  /** When the session was last active */
  lastActiveAt?: number;

  /** Number of messages in the session */
  messageCount?: number;

  /** Preview of the last message */
  lastMessagePreview?: string;
}

export interface SessionsListResult {
  sessions: Session[];
  total?: number;
}

export interface SessionsListParams {
  /** Filter by channel */
  channel?: string;

  /** Filter by label pattern */
  labelPattern?: string;

  /** Include archived sessions */
  includeArchived?: boolean;

  /** Maximum number of sessions to return */
  limit?: number;

  /** Offset for pagination */
  offset?: number;

  /** Sort order */
  sort?: "recent" | "created" | "label";
}
