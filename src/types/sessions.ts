/**
 * Session Types
 */

export interface Session {
  /** Unique session key */
  key: string;

  /** Human-readable label */
  label?: string;

  /** Session kind */
  kind: "main" | "isolated" | "channel";

  /** Which channel this session is associated with */
  channel?: string;

  /** Current model override (if any) */
  model?: string;

  /** When the session was created */
  createdAt: number;

  /** When the session was last active */
  lastActiveAt: number;
}
