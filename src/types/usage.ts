/**
 * Provider usage types
 *
 * Matches OpenClaw's provider-usage.types.ts
 */

export type UsageProviderId =
  | "anthropic"
  | "github-copilot"
  | "google-gemini-cli"
  | "google-antigravity"
  | "minimax"
  | "openai-codex"
  | "xiaomi"
  | "zai";

export type UsageWindow = {
  /** Window label (e.g., "5h", "Week", "Sonnet", "Opus") */
  label: string;
  /** Usage percentage (0-100) */
  usedPercent: number;
  /** Reset timestamp (ms since epoch) */
  resetAt?: number;
};

export type ProviderUsageSnapshot = {
  /** Provider identifier */
  provider: UsageProviderId;
  /** Human-readable provider name */
  displayName: string;
  /** Usage windows */
  windows: UsageWindow[];
  /** Plan name (if available) */
  plan?: string;
  /** Error message (if fetch failed) */
  error?: string;
};

export type UsageSummary = {
  /** When this data was fetched */
  updatedAt: number;
  /** Usage data per provider */
  providers: ProviderUsageSnapshot[];
};

/**
 * Usage level for styling
 */
export type UsageLevel = "low" | "medium" | "high" | "critical";

/**
 * Get usage level from percentage
 */
export function getUsageLevel(percent: number): UsageLevel {
  if (percent >= 90) return "critical";
  if (percent >= 80) return "high";
  if (percent >= 50) return "medium";
  return "low";
}
