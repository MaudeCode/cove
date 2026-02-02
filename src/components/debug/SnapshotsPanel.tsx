/**
 * SnapshotsPanel
 *
 * Shows status, health, and heartbeat snapshots from the gateway.
 * Displays key metrics in a readable format instead of raw JSON.
 */

import { signal } from "@preact/signals";
import { t } from "@/lib/i18n";
import { isConnected, send } from "@/lib/gateway";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  Database,
  RefreshCw,
  Activity,
  Heart,
  Zap,
  ChevronDown,
  ChevronRight,
} from "lucide-preact";

// ============================================
// Types
// ============================================

interface StatusData {
  heartbeat?: {
    defaultAgentId?: string;
    agents?: Array<{
      agentId: string;
      enabled: boolean;
      every?: string;
      everyMs?: number;
    }>;
  };
  recent?: Array<{
    agentId?: string;
    key?: string;
    kind?: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    remainingTokens?: number;
    percentUsed?: number;
    contextTokens?: number;
    updatedAt?: number;
  }>;
}

interface HealthData {
  ok?: boolean;
  ts?: number;
  durationMs?: number;
  channels?: Record<
    string,
    {
      configured?: boolean;
      running?: boolean;
      lastError?: string | null;
      accounts?: Record<string, { configured?: boolean; running?: boolean }>;
    }
  >;
}

// ============================================
// State
// ============================================

const statusData = signal<StatusData | null>(null);
const healthData = signal<HealthData | null>(null);
const isLoading = signal(false);
const showRawJson = signal(false);

// ============================================
// Helpers
// ============================================

function formatTokens(n: number | undefined): string {
  if (n == null) return "—";
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function formatPercent(n: number | undefined): string {
  if (n == null) return "—";
  return `${Math.round(n)}%`;
}

function formatDuration(ms: number | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

async function fetchSnapshots() {
  if (!isConnected.value) return;

  isLoading.value = true;
  try {
    const [status, health] = await Promise.all([
      send<StatusData>("status").catch(() => null),
      send<HealthData>("health.check").catch(() => null),
    ]);
    statusData.value = status;
    healthData.value = health;
  } catch {
    // Ignore errors
  } finally {
    isLoading.value = false;
  }
}

// ============================================
// Sub-components
// ============================================

function StatItem({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div class="text-center">
      <div class="text-lg font-semibold text-[var(--color-text-primary)]">{value}</div>
      <div class="text-xs text-[var(--color-text-muted)]">{label}</div>
      {sub && <div class="text-xs text-[var(--color-text-muted)] opacity-70">{sub}</div>}
    </div>
  );
}

function ChannelStatus({
  name,
  data,
}: {
  name: string;
  data: { configured?: boolean; running?: boolean; lastError?: string | null };
}) {
  const status = data.running ? "success" : data.configured ? "warning" : "default";
  const label = data.running ? "Running" : data.configured ? "Configured" : "Off";

  return (
    <div class="flex items-center justify-between py-1.5">
      <span class="text-sm capitalize">{name}</span>
      <Badge variant={status} size="sm">
        {label}
      </Badge>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function SnapshotsPanel() {
  const connected = isConnected.value;
  const status = statusData.value;
  const health = healthData.value;
  const recentSession = status?.recent?.[0];

  return (
    <Card>
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <Database size={18} class="text-[var(--color-accent)]" />
          <h2 class="font-medium">{t("debug.snapshots")}</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchSnapshots}
          disabled={!connected}
          loading={isLoading.value}
          icon={<RefreshCw size={14} />}
        >
          {t("actions.refresh")}
        </Button>
      </div>

      {!status && !health ? (
        <p class="text-sm text-[var(--color-text-muted)] text-center py-6">{t("debug.noData")}</p>
      ) : (
        <div class="space-y-5">
          {/* Session Stats */}
          {recentSession && (
            <div>
              <div class="flex items-center gap-2 mb-3">
                <Activity size={14} class="text-[var(--color-text-muted)]" />
                <span class="text-sm font-medium">{t("debug.recentSession")}</span>
                {recentSession.model && (
                  <Badge variant="default" size="sm">
                    {recentSession.model}
                  </Badge>
                )}
              </div>
              <div class="grid grid-cols-4 gap-2 p-3 bg-[var(--color-bg-tertiary)] rounded-lg">
                <StatItem label="Input" value={formatTokens(recentSession.inputTokens)} />
                <StatItem label="Output" value={formatTokens(recentSession.outputTokens)} />
                <StatItem label="Total" value={formatTokens(recentSession.totalTokens)} />
                <StatItem
                  label="Used"
                  value={formatPercent(recentSession.percentUsed)}
                  sub={`of ${formatTokens(recentSession.contextTokens)}`}
                />
              </div>
            </div>
          )}

          {/* Health Status */}
          {health && (
            <div>
              <div class="flex items-center gap-2 mb-3">
                <Heart size={14} class="text-[var(--color-text-muted)]" />
                <span class="text-sm font-medium">{t("debug.health")}</span>
                <Badge variant={health.ok ? "success" : "error"} size="sm">
                  {health.ok ? "Healthy" : "Unhealthy"}
                </Badge>
                {health.durationMs != null && (
                  <span class="text-xs text-[var(--color-text-muted)]">
                    ({formatDuration(health.durationMs)})
                  </span>
                )}
              </div>
              {health.channels && Object.keys(health.channels).length > 0 && (
                <div class="p-3 bg-[var(--color-bg-tertiary)] rounded-lg divide-y divide-[var(--color-border)]">
                  {Object.entries(health.channels).map(([name, data]) => (
                    <ChannelStatus key={name} name={name} data={data} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Heartbeat Agents */}
          {status?.heartbeat?.agents && status.heartbeat.agents.length > 0 && (
            <div>
              <div class="flex items-center gap-2 mb-3">
                <Zap size={14} class="text-[var(--color-text-muted)]" />
                <span class="text-sm font-medium">{t("debug.heartbeatAgents")}</span>
              </div>
              <div class="p-3 bg-[var(--color-bg-tertiary)] rounded-lg space-y-2">
                {status.heartbeat.agents.map((agent) => (
                  <div key={agent.agentId} class="flex items-center justify-between">
                    <span class="text-sm font-mono">{agent.agentId}</span>
                    <div class="flex items-center gap-2">
                      {agent.every && (
                        <span class="text-xs text-[var(--color-text-muted)]">{agent.every}</span>
                      )}
                      <Badge variant={agent.enabled ? "success" : "default"} size="sm">
                        {agent.enabled ? "On" : "Off"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw JSON Toggle */}
          <button
            type="button"
            onClick={() => {
              showRawJson.value = !showRawJson.value;
            }}
            class="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
          >
            {showRawJson.value ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {t("debug.showRawJson")}
          </button>

          {showRawJson.value && (
            <pre class="text-xs font-mono bg-[var(--color-bg-tertiary)] p-3 rounded-lg overflow-x-auto max-h-48">
              {JSON.stringify({ status, health }, null, 2)}
            </pre>
          )}
        </div>
      )}
    </Card>
  );
}
