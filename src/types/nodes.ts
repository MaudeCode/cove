/**
 * Node Types
 *
 * Types for paired mobile nodes/devices.
 */

/** Node entry from node.list */
export interface NodeEntry {
  nodeId: string;
  displayName?: string;
  platform?: string;
  version?: string;
  coreVersion?: string;
  uiVersion?: string;
  deviceFamily?: string;
  modelIdentifier?: string;
  remoteIp?: string;
  caps: string[];
  commands: string[];
  pathEnv?: string;
  permissions?: NodePermissions;
  connectedAtMs?: number;
  paired: boolean;
  connected: boolean;
}

/** Node permissions (from iOS/Android companion app) */
export interface NodePermissions {
  camera?: boolean;
  location?: boolean;
  notifications?: boolean;
  screenRecording?: boolean;
}

/** Response from node.list */
export interface NodeListResponse {
  ts: number;
  nodes: NodeEntry[];
}

/** Pending pairing request */
export interface PairingRequest {
  requestId: string;
  nodeId: string;
  displayName?: string;
  platform?: string;
  version?: string;
  coreVersion?: string;
  uiVersion?: string;
  deviceFamily?: string;
  modelIdentifier?: string;
  caps?: string[];
  commands?: string[];
  remoteIp?: string;
  createdAt: number;
}

/** Response from node.pair.list */
export interface PairingListResponse {
  pending: PairingRequest[];
}

/** Node connection status for display */
export type NodeStatus = "connected" | "paired" | "pending";

/** Get display status for a node */
export function getNodeStatus(node: NodeEntry): NodeStatus {
  if (node.connected) return "connected";
  return "paired";
}

/** Check if node supports a command */
export function nodeSupportsCommand(node: NodeEntry, command: string): boolean {
  return node.commands.includes(command);
}

/** Get platform icon */
export function getPlatformIcon(platform?: string): string {
  switch (platform?.toLowerCase()) {
    case "ios":
      return "🍎";
    case "android":
      return "🤖";
    case "macos":
      return "💻";
    case "windows":
      return "🪟";
    case "linux":
      return "🐧";
    default:
      return "📱";
  }
}
