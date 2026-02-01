/**
 * Channel Types
 *
 * Types for the channels.status API response.
 */

/** Channel account snapshot from gateway */
export interface ChannelAccountSnapshot {
  accountId: string;
  name?: string;
  enabled?: boolean;
  configured?: boolean;
  linked?: boolean;
  running?: boolean;
  connected?: boolean;
  reconnectAttempts?: number;
  lastConnectedAt?: number | null;
  lastDisconnect?:
    | string
    | {
        at: number;
        status?: number;
        error?: string;
        loggedOut?: boolean;
      }
    | null;
  lastMessageAt?: number | null;
  lastEventAt?: number | null;
  lastError?: string | null;
  lastStartAt?: number | null;
  lastStopAt?: number | null;
  lastInboundAt?: number | null;
  lastOutboundAt?: number | null;
  lastProbeAt?: number | null;
  mode?: string;
  dmPolicy?: string;
  allowFrom?: string[];
  tokenSource?: string;
  botTokenSource?: string;
  appTokenSource?: string;
  credentialSource?: string;
  audienceType?: string;
  audience?: string;
  webhookPath?: string;
  webhookUrl?: string;
  baseUrl?: string;
  allowUnmentionedGroups?: boolean;
  cliPath?: string | null;
  dbPath?: string | null;
  port?: number | null;
  probe?: ChannelProbeResult;
  audit?: ChannelAuditResult;
  application?: {
    intents?: {
      messageContent?: string;
    };
  };
  bot?: {
    username?: string | null;
    id?: string | null;
  };
}

/** Probe result from health check */
export interface ChannelProbeResult {
  ok?: boolean;
  error?: string;
  bot?: {
    username?: string | null;
  };
  [key: string]: unknown;
}

/** Audit result from health check */
export interface ChannelAuditResult {
  ok?: boolean;
  issues?: Array<{
    kind: string;
    message: string;
    fix?: string;
  }>;
  [key: string]: unknown;
}

/** Channel UI metadata entry */
export interface ChannelUiMetaEntry {
  id: string;
  label: string;
  detailLabel: string;
  systemImage?: string;
}

/** Channel summary (per-channel status) */
export interface ChannelSummary {
  configured?: boolean;
  connected?: boolean;
  enabled?: boolean;
  error?: string;
  [key: string]: unknown;
}

/** Full channels.status response */
export interface ChannelsStatusResponse {
  ts: number;
  channelOrder: string[];
  channelLabels: Record<string, string>;
  channelDetailLabels: Record<string, string>;
  channelSystemImages: Record<string, string>;
  channelMeta: ChannelUiMetaEntry[];
  channels: Record<string, ChannelSummary>;
  channelAccounts: Record<string, ChannelAccountSnapshot[]>;
  channelDefaultAccountId: Record<string, string>;
}

/** Aggregated channel data for display */
export interface ChannelDisplayData {
  id: string;
  label: string;
  detailLabel: string;
  systemImage?: string;
  summary: ChannelSummary;
  accounts: ChannelAccountSnapshot[];
  defaultAccountId: string;
  /** Computed status for display */
  status: ChannelStatus;
}

/** Computed channel status */
export type ChannelStatus = "connected" | "configured" | "not-configured" | "disabled" | "error";

/** Derive channel status from accounts */
export function deriveChannelStatus(accounts: ChannelAccountSnapshot[]): ChannelStatus {
  if (accounts.length === 0) {
    return "not-configured";
  }

  const hasError = accounts.some((a) => a.lastError);
  if (hasError) {
    return "error";
  }

  const hasConnected = accounts.some((a) => a.connected);
  if (hasConnected) {
    return "connected";
  }

  const hasEnabled = accounts.some((a) => a.enabled !== false);
  if (!hasEnabled) {
    return "disabled";
  }

  const hasConfigured = accounts.some((a) => a.configured);
  if (hasConfigured) {
    return "configured";
  }

  return "not-configured";
}

/** Transform API response to display data */
export function transformChannelsResponse(response: ChannelsStatusResponse): ChannelDisplayData[] {
  return response.channelOrder.map((id) => {
    const accounts = response.channelAccounts[id] || [];
    return {
      id,
      label: response.channelLabels[id] || id,
      detailLabel: response.channelDetailLabels[id] || response.channelLabels[id] || id,
      systemImage: response.channelSystemImages[id],
      summary: response.channels[id] || {},
      accounts,
      defaultAccountId: response.channelDefaultAccountId[id] || "default",
      status: deriveChannelStatus(accounts),
    };
  });
}
