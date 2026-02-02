/**
 * Exec Approval Types
 *
 * Types for the interactive exec approval system.
 * When exec.ask is enabled, commands require user approval.
 */

/** Request payload from exec.approval event */
export interface ExecApprovalRequest {
  /** Unique request ID */
  requestId: string;
  /** The shell command being requested */
  command: string;
  /** Host where command will run */
  host?: string;
  /** Agent ID making the request */
  agentId?: string;
  /** Session key for the request */
  sessionKey?: string;
  /** Working directory */
  cwd?: string;
  /** Resolved command path */
  resolvedPath?: string;
  /** Security mode (deny|allowlist|full) */
  security?: string;
  /** Ask mode (off|on-miss|always) */
  ask?: string;
  /** Expiration timestamp (ms since epoch) */
  expiresAtMs: number;
}

/** Queued approval item with computed expiration */
export interface ExecApprovalItem {
  /** The original request */
  request: ExecApprovalRequest;
  /** When this request expires */
  expiresAtMs: number;
  /** Timestamp when request was received */
  receivedAt: number;
}

/** Decision types for exec approval */
export type ExecApprovalDecision = "allow-once" | "allow-always" | "deny";
