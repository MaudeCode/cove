/**
 * ServerStatsView
 *
 * Gateway server statistics and usage metrics.
 * Route: /stats
 */

import { signal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { t } from "@/lib/i18n";
import {
  send,
  isConnected,
  gatewayVersion,
  gatewayHost,
  gatewayUptime,
  gatewayConfigPath,
  gatewayStateDir,
} from "@/lib/gateway";
import { getErrorMessage, formatVersion } from "@/lib/session-utils";
import { toast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { IconButton } from "@/components/ui/IconButton";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  RefreshCw,
  Server,
  Clock,
  Cpu,
  Activity,
  Zap,
  TrendingUp,
  Calendar,
  FileText,
  FolderOpen,
} from "lucide-preact";
import type { CostUsageSummary, HealthSummary } from "@/types/server-stats";
import { formatUptime, formatTokenCount, formatCost } from "@/types/server-stats";

import type { RouteProps } from "@/types/routes";

// ============================================
// Local State
// ============================================

const healthData = signal<HealthSummary | null>(null);
const usageData = signal<CostUsageSummary | null>(null);
const isLoading = signal<boolean>(false);
const isLoadingUsage = signal<boolean>(false);
const error = signal<string | null>(null);
const usageDays = signal<number>(30);

// ============================================
// Actions
// ============================================

async function loadHealth(): Promise<void> {
  isLoading.value = true;
  error.value = null;

  try {
    const result = await send<HealthSummary>("health", { probe: false });
    healthData.value = result;
  } catch (err) {
    error.value = getErrorMessage(err);
    toast.error(t("stats.loadError"));
  } finally {
    isLoading.value = false;
  }
}

async function loadUsage(days: number = 30): Promise<void> {
  isLoadingUsage.value = true;

  try {
    const result = await send<CostUsageSummary>("usage.cost", { days });
    usageData.value = result;
    usageDays.value = days;
  } catch {
    // Usage might not be available - silently ignore
  } finally {
    isLoadingUsage.value = false;
  }
}

async function loadAll(): Promise<void> {
  await Promise.all([loadHealth(), loadUsage(usageDays.value)]);
}

// ============================================
// Components
// ============================================

function GatewayInfoCard() {
  const uptime = gatewayUptime.value;

  return (
    <Card padding="md">
      <div class="flex items-center gap-3 mb-4">
        <div class="p-2 rounded-lg bg-[var(--color-accent)]/10">
          <Server class="w-5 h-5 text-[var(--color-accent)]" />
        </div>
        <div>
          <h3 class="font-semibold">{t("stats.gateway.title")}</h3>
          <p class="text-sm text-[var(--color-text-muted)]">
            {gatewayHost.value || t("stats.gateway.unknown")}
          </p>
        </div>
        {gatewayVersion.value && (
          <Badge variant="default" size="sm" class="ml-auto">
            {formatVersion(gatewayVersion.value)}
          </Badge>
        )}
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="flex items-center gap-2">
          <Clock class="w-4 h-4 text-[var(--color-text-muted)]" />
          <div>
            <div class="text-sm text-[var(--color-text-muted)]">{t("stats.gateway.uptime")}</div>
            <div class="font-medium">{uptime != null ? formatUptime(uptime) : "-"}</div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <Activity class="w-4 h-4 text-[var(--color-text-muted)]" />
          <div>
            <div class="text-sm text-[var(--color-text-muted)]">{t("stats.gateway.sessions")}</div>
            <div class="font-medium">{healthData.value?.sessions?.count ?? "-"}</div>
          </div>
        </div>
      </div>

      {(gatewayConfigPath.value || gatewayStateDir.value) && (
        <div class="mt-4 pt-4 border-t border-[var(--color-border)] space-y-2">
          {gatewayConfigPath.value && (
            <div class="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
              <FileText class="w-3.5 h-3.5" />
              <span class="truncate font-mono">{gatewayConfigPath.value}</span>
            </div>
          )}
          {gatewayStateDir.value && (
            <div class="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
              <FolderOpen class="w-3.5 h-3.5" />
              <span class="truncate font-mono">{gatewayStateDir.value}</span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function UsageSummaryCard() {
  const usage = usageData.value;

  if (!usage) {
    return (
      <Card padding="md">
        <div class="flex items-center gap-3 mb-4">
          <div class="p-2 rounded-lg bg-[var(--color-success)]/10">
            <TrendingUp class="w-5 h-5 text-[var(--color-success)]" />
          </div>
          <h3 class="font-semibold">{t("stats.usage.title")}</h3>
        </div>
        <p class="text-sm text-[var(--color-text-muted)]">
          {isLoadingUsage.value ? t("status.loading") : t("stats.usage.unavailable")}
        </p>
      </Card>
    );
  }

  const totals = usage.totals;

  return (
    <Card padding="md">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-lg bg-[var(--color-success)]/10">
            <TrendingUp class="w-5 h-5 text-[var(--color-success)]" />
          </div>
          <div>
            <h3 class="font-semibold">{t("stats.usage.title")}</h3>
            <p class="text-sm text-[var(--color-text-muted)]">
              {t("stats.usage.period", { days: usage.days })}
            </p>
          </div>
        </div>
        {totals.totalCost > 0 && (
          <div class="text-right">
            <div class="text-2xl font-bold text-[var(--color-success)]">
              {formatCost(totals.totalCost)}
            </div>
            <div class="text-xs text-[var(--color-text-muted)]">{t("stats.usage.totalCost")}</div>
          </div>
        )}
      </div>

      <div class="grid grid-cols-3 gap-4">
        <div>
          <div class="text-sm text-[var(--color-text-muted)]">{t("stats.usage.input")}</div>
          <div class="font-medium">{formatTokenCount(totals.input)}</div>
        </div>
        <div>
          <div class="text-sm text-[var(--color-text-muted)]">{t("stats.usage.output")}</div>
          <div class="font-medium">{formatTokenCount(totals.output)}</div>
        </div>
        <div>
          <div class="text-sm text-[var(--color-text-muted)]">{t("stats.usage.total")}</div>
          <div class="font-medium">{formatTokenCount(totals.totalTokens)}</div>
        </div>
      </div>

      {(totals.cacheRead > 0 || totals.cacheWrite > 0) && (
        <div class="mt-4 pt-4 border-t border-[var(--color-border)]">
          <div class="text-sm text-[var(--color-text-muted)] mb-2">{t("stats.usage.cache")}</div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <div class="text-xs text-[var(--color-text-muted)]">{t("stats.usage.cacheRead")}</div>
              <div class="font-medium">{formatTokenCount(totals.cacheRead)}</div>
            </div>
            <div>
              <div class="text-xs text-[var(--color-text-muted)]">
                {t("stats.usage.cacheWrite")}
              </div>
              <div class="font-medium">{formatTokenCount(totals.cacheWrite)}</div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function DailyUsageChart() {
  const usage = usageData.value;

  if (!usage || usage.daily.length === 0) {
    return null;
  }

  // Get last 14 days for display
  const recentDays = usage.daily.slice(-14);
  const maxTokens = Math.max(...recentDays.map((d) => d.totalTokens), 1);

  return (
    <Card padding="md">
      <div class="flex items-center gap-3 mb-4">
        <div class="p-2 rounded-lg bg-[var(--color-info)]/10">
          <Calendar class="w-5 h-5 text-[var(--color-info)]" />
        </div>
        <h3 class="font-semibold">{t("stats.daily.title")}</h3>
      </div>

      <div class="space-y-2">
        {recentDays.map((day) => {
          const pct = (day.totalTokens / maxTokens) * 100;
          const dateObj = new Date(day.date);
          const dateLabel = dateObj.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          });

          return (
            <div key={day.date} class="flex items-center gap-3">
              <div class="w-20 text-xs text-[var(--color-text-muted)] truncate">{dateLabel}</div>
              <div class="flex-1 h-4 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                <div
                  class="h-full bg-[var(--color-accent)] rounded-full transition-all"
                  style={{ width: `${Math.max(pct, 1)}%` }}
                />
              </div>
              <div class="w-16 text-xs text-right font-mono">
                {formatTokenCount(day.totalTokens)}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function AgentsCard() {
  const health = healthData.value;

  if (!health?.agents || health.agents.length === 0) {
    return null;
  }

  return (
    <Card padding="md">
      <div class="flex items-center gap-3 mb-4">
        <div class="p-2 rounded-lg bg-[var(--color-warning)]/10">
          <Cpu class="w-5 h-5 text-[var(--color-warning)]" />
        </div>
        <h3 class="font-semibold">{t("stats.agents.title")}</h3>
      </div>

      <div class="space-y-3">
        {health.agents.map((agent) => (
          <div
            key={agent.agentId}
            class="flex items-center justify-between py-2 px-3 bg-[var(--color-bg-secondary)] rounded-lg"
          >
            <div class="flex items-center gap-2">
              <span class="font-medium">{agent.name || agent.agentId}</span>
              {agent.isDefault && (
                <Badge variant="success" size="sm">
                  {t("stats.agents.default")}
                </Badge>
              )}
            </div>
            <div class="flex items-center gap-4 text-sm text-[var(--color-text-muted)]">
              <span>
                {agent.sessions.count} {t("stats.agents.sessions")}
              </span>
              {agent.heartbeat.enabled && (
                <span class="flex items-center gap-1">
                  <Zap class="w-3.5 h-3.5" />
                  {agent.heartbeat.every}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================================
// Main View
// ============================================

export function ServerStatsView(_props: RouteProps) {
  useEffect(() => {
    if (isConnected.value) {
      loadAll();
    }
  }, [isConnected.value]);

  return (
    <div class="flex-1 overflow-y-auto p-6">
      <div class="max-w-4xl mx-auto space-y-6">
        <PageHeader
          title={t("stats.title")}
          subtitle={t("stats.description")}
          actions={
            <IconButton
              icon={<RefreshCw class={`w-4 h-4 ${isLoading.value ? "animate-spin" : ""}`} />}
              label={t("actions.refresh")}
              onClick={() => loadAll()}
              disabled={isLoading.value || !isConnected.value}
              variant="ghost"
            />
          }
        />

        {/* Error */}
        {error.value && (
          <div class="p-4 rounded-xl bg-[var(--color-error)]/10 text-[var(--color-error)]">
            {error.value}
          </div>
        )}

        {/* Loading / Connecting */}
        {(isLoading.value && !healthData.value) || !isConnected.value ? (
          <div class="flex justify-center py-16">
            <Spinner size="lg" label={!isConnected.value ? t("status.connecting") : undefined} />
          </div>
        ) : (
          <div class="grid gap-6 md:grid-cols-2">
            {/* Gateway Info */}
            <GatewayInfoCard />

            {/* Usage Summary */}
            <UsageSummaryCard />

            {/* Daily Usage Chart */}
            <div class="md:col-span-2">
              <DailyUsageChart />
            </div>

            {/* Agents */}
            <div class="md:col-span-2">
              <AgentsCard />
            </div>
          </div>
        )}

        {/* Usage Period Selector */}
        {usageData.value && (
          <div class="flex justify-center gap-2">
            {[7, 14, 30, 90].map((days) => (
              <Button
                key={days}
                variant={usageDays.value === days ? "primary" : "ghost"}
                size="sm"
                onClick={() => loadUsage(days)}
                disabled={isLoadingUsage.value}
              >
                {days}d
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
