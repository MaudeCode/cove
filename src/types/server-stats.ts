/**
 * Server Stats Types
 *
 * Types for the gateway server statistics and usage data.
 */

// ============================================
// Usage/Cost Types
// ============================================

export interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
}

export interface DailyUsage extends UsageTotals {
  date: string; // YYYY-MM-DD
}

export interface CostUsageSummary {
  days: number;
  totals: UsageTotals;
  daily: DailyUsage[];
}

// ============================================
// Health Types
// ============================================

export interface HealthSummary {
  ok: true;
  ts: number;
  durationMs: number;
  heartbeatSeconds: number;
  defaultAgentId: string;
  agents: AgentHealthSummary[];
  sessions: {
    path: string;
    count: number;
    recent: Array<{
      key: string;
      updatedAt: number | null;
      age: number | null;
    }>;
  };
  channels: Record<string, unknown>;
  channelOrder: string[];
  channelLabels: Record<string, string>;
}

export interface AgentHealthSummary {
  agentId: string;
  name?: string;
  isDefault: boolean;
  heartbeat: {
    enabled: boolean;
    every: string;
    everyMs: number;
  };
  sessions: {
    path: string;
    count: number;
    recent: Array<{
      key: string;
      updatedAt: number | null;
      age: number | null;
    }>;
  };
}

// ============================================
// Display Helpers
// ============================================

export function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  }
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${seconds}s`;
}

export function formatTokenCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return count.toString();
}

export function formatCost(usd: number): string {
  if (usd >= 1) {
    return `$${usd.toFixed(2)}`;
  }
  if (usd >= 0.01) {
    return `$${usd.toFixed(2)}`;
  }
  if (usd > 0) {
    return `$${usd.toFixed(4)}`;
  }
  return "$0.00";
}
