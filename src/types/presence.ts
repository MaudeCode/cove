/**
 * Presence Types
 *
 * Matches OpenClaw gateway system-presence response.
 */

export interface SystemPresence {
  host?: string;
  ip?: string;
  version?: string;
  platform?: string;
  deviceFamily?: string;
  modelIdentifier?: string;
  lastInputSeconds?: number;
  mode?: string;
  reason?: string;
  deviceId?: string;
  instanceId?: string;
  roles?: string[];
  scopes?: string[];
  text: string;
  ts: number;
}
