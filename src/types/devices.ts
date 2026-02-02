/**
 * Device Types
 *
 * Types for device pairing and management.
 * Devices include operators (webchat) and nodes (mobile apps, node hosts).
 */

/** Pending device pairing request */
export interface DevicePendingRequest {
  requestId: string;
  deviceId: string;
  publicKey: string;
  displayName?: string;
  platform?: string;
  clientId?: string;
  clientMode?: string;
  role?: string;
  roles?: string[];
  scopes?: string[];
  remoteIp?: string;
  silent?: boolean;
  isRepair?: boolean;
  ts: number;
}

/** Device auth token summary (token value redacted) */
export interface DeviceTokenSummary {
  role: string;
  scopes: string[];
  createdAtMs: number;
  rotatedAtMs?: number;
  revokedAtMs?: number;
  lastUsedAtMs?: number;
}

/** Paired device */
export interface PairedDevice {
  deviceId: string;
  publicKey: string;
  displayName?: string;
  platform?: string;
  clientId?: string;
  clientMode?: string;
  role?: string;
  roles?: string[];
  scopes?: string[];
  remoteIp?: string;
  tokens?: Record<string, DeviceTokenSummary>;
  createdAtMs: number;
  approvedAtMs: number;
}

/** Response from device.pair.list */
export interface DeviceListResponse {
  pending: DevicePendingRequest[];
  paired: PairedDevice[];
}

/** Device role for filtering */
export type DeviceRole = "operator" | "node" | "all";

/** Get the primary role of a device */
export function getDeviceRole(device: PairedDevice | DevicePendingRequest): string {
  if (device.role) return device.role;
  if (device.roles && device.roles.length > 0) return device.roles[0];
  return "unknown";
}

/** Check if device is a node */
export function isNodeDevice(device: PairedDevice | DevicePendingRequest): boolean {
  if (device.role === "node") return true;
  if (device.roles?.includes("node")) return true;
  return false;
}

/** Check if device is an operator */
export function isOperatorDevice(device: PairedDevice | DevicePendingRequest): boolean {
  if (device.role === "operator") return true;
  if (device.roles?.includes("operator")) return true;
  return false;
}

/** Get role badge variant */
export function getRoleBadgeVariant(role: string): "success" | "info" | "default" {
  switch (role) {
    case "operator":
      return "info";
    case "node":
      return "success";
    default:
      return "default";
  }
}

/** Get platform icon */
export function getPlatformIcon(platform?: string): string {
  switch (platform?.toLowerCase()) {
    case "ios":
      return "🍎";
    case "android":
      return "🤖";
    case "macos":
    case "darwin":
      return "💻";
    case "windows":
    case "win32":
      return "🪟";
    case "linux":
      return "🐧";
    case "web":
      return "🌐";
    default:
      return "📱";
  }
}

/** Format device ID for display (truncate if too long) */
export function formatDeviceId(deviceId: string): string {
  if (deviceId.length <= 20) return deviceId;
  return `${deviceId.slice(0, 10)}...${deviceId.slice(-6)}`;
}
