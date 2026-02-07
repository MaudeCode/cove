/**
 * UsageView
 *
 * Token usage analytics and cost tracking.
 * Route: /usage
 */

import { signal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { t, formatTimestamp } from "@/lib/i18n";
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
  Users,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-preact";
import { ViewErrorBoundary } from "@/components/ui/ViewErrorBoundary";
import type {
  CostUsageSummary,
  HealthSummary,
  SessionsUsageResult,
  SessionUsageEntry,
} from "@/types/server-stats";
import { formatUptime, formatTokenCount, formatCost } from "@/types/server-stats";

import type { RouteProps } from "@/types/routes";

// ============================================
// Local State
// ============================================

const healthData = signal<HealthSummary | null>(null);
const usageData = signal<CostUsageSummary | null>(null);
const sessionsUsage = signal<SessionsUsageResult | null>(null);
const selectedSession = signal<SessionUsageEntry | null>(null);
const isLoading = signal<boolean>(false);
const isLoadingUsage = signal<boolean>(false);
const isLoadingSessionsUsage = signal<boolean>(false);
const error = signal<string | null>(null);
const usageDays = signal<number>(30);
const sessionsSortBy = signal<"cost" | "tokens" | "recent">("cost");
const sessionsSortDesc = signal<boolean>(true);

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
    toast.error(t("usage.loadError"));
  } finally {
    isLoading.value = false;
  }
}

async function loadUsage(days: number = 30): Promise<void> {
  isLoadingUsage.value = true;
  usageDays.value = days;

  try {
    const result = await send<CostUsageSummary>("usage.cost", { days });
    usageData.value = result;
  } catch {
    // Usage might not be available - silently ignore
  } finally {
    isLoadingUsage.value = false;
  }

  // Also reload sessions usage when period changes
  void loadSessionsUsage(days);
}

async function loadSessionsUsage(days: number = 30): Promise<void> {
  isLoadingSessionsUsage.value = true;

  try {
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await send<SessionsUsageResult>("sessions.usage", {
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
      limit: 100,
      includeContextWeight: true,
    });
    sessionsUsage.value = result;
  } catch {
    // Sessions usage might not be available - silently ignore
    sessionsUsage.value = null;
  } finally {
    isLoadingSessionsUsage.value = false;
  }
}

async function loadAll(): Promise<void> {
  await Promise.all([loadHealth(), loadUsage(usageDays.value), loadSessionsUsage(usageDays.value)]);
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
          <h3 class="font-semibold">{t("usage.gateway.title")}</h3>
          <p class="text-sm text-[var(--color-text-muted)]">
            {gatewayHost.value || t("usage.gateway.unknown")}
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
            <div class="text-sm text-[var(--color-text-muted)]">{t("usage.gateway.uptime")}</div>
            <div class="font-medium">{uptime != null ? formatUptime(uptime) : "-"}</div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <Activity class="w-4 h-4 text-[var(--color-text-muted)]" />
          <div>
            <div class="text-sm text-[var(--color-text-muted)]">{t("usage.gateway.sessions")}</div>
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
          <h3 class="font-semibold">{t("usage.summary.title")}</h3>
        </div>
        <p class="text-sm text-[var(--color-text-muted)]">
          {isLoadingUsage.value ? t("status.loading") : t("usage.summary.unavailable")}
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
            <h3 class="font-semibold">{t("usage.summary.title")}</h3>
            <p class="text-sm text-[var(--color-text-muted)]">
              {t("usage.summary.period", { days: usage.days })}
            </p>
          </div>
        </div>
        {totals.totalCost > 0 && (
          <div class="text-right">
            <div class="text-2xl font-bold text-[var(--color-success)]">
              {formatCost(totals.totalCost)}
            </div>
            <div class="text-xs text-[var(--color-text-muted)]">{t("usage.summary.totalCost")}</div>
          </div>
        )}
      </div>

      <div class="grid grid-cols-3 gap-4">
        <div>
          <div class="text-sm text-[var(--color-text-muted)]">{t("usage.summary.input")}</div>
          <div class="font-medium">{formatTokenCount(totals.input)}</div>
        </div>
        <div>
          <div class="text-sm text-[var(--color-text-muted)]">{t("usage.summary.output")}</div>
          <div class="font-medium">{formatTokenCount(totals.output)}</div>
        </div>
        <div>
          <div class="text-sm text-[var(--color-text-muted)]">{t("usage.summary.total")}</div>
          <div class="font-medium">{formatTokenCount(totals.totalTokens)}</div>
        </div>
      </div>

      {(totals.cacheRead > 0 || totals.cacheWrite > 0) && (
        <div class="mt-4 pt-4 border-t border-[var(--color-border)]">
          <div class="text-sm text-[var(--color-text-muted)] mb-2">{t("usage.summary.cache")}</div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <div class="text-xs text-[var(--color-text-muted)]">
                {t("usage.summary.cacheRead")}
              </div>
              <div class="font-medium">{formatTokenCount(totals.cacheRead)}</div>
            </div>
            <div>
              <div class="text-xs text-[var(--color-text-muted)]">
                {t("usage.summary.cacheWrite")}
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
        <h3 class="font-semibold">{t("usage.daily.title")}</h3>
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

function SessionUsageTable() {
  const data = sessionsUsage.value;
  const selected = selectedSession.value;

  if (!data || data.sessions.length === 0) {
    return null;
  }

  // Sort sessions
  const sortedSessions = [...data.sessions].sort((a, b) => {
    const sortBy = sessionsSortBy.value;
    const desc = sessionsSortDesc.value;
    let cmp = 0;

    if (sortBy === "cost") {
      cmp = (a.usage.totalCost || 0) - (b.usage.totalCost || 0);
    } else if (sortBy === "tokens") {
      cmp = (a.usage.totalTokens || 0) - (b.usage.totalTokens || 0);
    } else if (sortBy === "recent") {
      cmp = (a.lastActiveAt || 0) - (b.lastActiveAt || 0);
    }

    return desc ? -cmp : cmp;
  });

  const toggleSort = (col: "cost" | "tokens" | "recent") => {
    if (sessionsSortBy.value === col) {
      sessionsSortDesc.value = !sessionsSortDesc.value;
    } else {
      sessionsSortBy.value = col;
      sessionsSortDesc.value = true;
    }
  };

  const SortIcon = ({ col }: { col: "cost" | "tokens" | "recent" }) => {
    if (sessionsSortBy.value !== col) return null;
    return sessionsSortDesc.value ? (
      <ChevronDown class="w-3 h-3 inline ml-1" />
    ) : (
      <ChevronUp class="w-3 h-3 inline ml-1" />
    );
  };

  return (
    <Card padding="md">
      <div class="flex items-center gap-3 mb-4">
        <div class="p-2 rounded-lg bg-[var(--color-info)]/10">
          <Users class="w-5 h-5 text-[var(--color-info)]" />
        </div>
        <h3 class="font-semibold">{t("usage.sessions.title")}</h3>
        {isLoadingSessionsUsage.value && <Spinner size="sm" />}
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-[var(--color-border)]">
              <th class="text-left py-2 px-2 font-medium text-[var(--color-text-muted)]">
                {t("usage.sessions.name")}
              </th>
              <th class="text-left py-2 px-2 font-medium text-[var(--color-text-muted)]">
                {t("usage.sessions.model")}
              </th>
              <th
                class="text-right py-2 px-2 font-medium text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-text-primary)]"
                onClick={() => toggleSort("tokens")}
                onKeyDown={(e) => e.key === "Enter" && toggleSort("tokens")}
                tabIndex={0}
                role="button"
              >
                {t("usage.sessions.tokens")}
                <SortIcon col="tokens" />
              </th>
              <th
                class="text-right py-2 px-2 font-medium text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-text-primary)]"
                onClick={() => toggleSort("cost")}
                onKeyDown={(e) => e.key === "Enter" && toggleSort("cost")}
                tabIndex={0}
                role="button"
              >
                {t("usage.sessions.cost")}
                <SortIcon col="cost" />
              </th>
              <th
                class="text-right py-2 px-2 font-medium text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-text-primary)]"
                onClick={() => toggleSort("recent")}
                onKeyDown={(e) => e.key === "Enter" && toggleSort("recent")}
                tabIndex={0}
                role="button"
              >
                {t("usage.sessions.lastActive")}
                <SortIcon col="recent" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedSessions.slice(0, 20).map((session) => {
              const isSelected = selected?.key === session.key;
              return (
                <tr
                  key={session.key}
                  class={`border-b border-[var(--color-border)] cursor-pointer transition-colors ${
                    isSelected ? "bg-[var(--color-accent)]/10" : "hover:bg-[var(--color-bg-hover)]"
                  }`}
                  onClick={() => {
                    selectedSession.value = isSelected ? null : session;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      selectedSession.value = isSelected ? null : session;
                    }
                  }}
                  tabIndex={0}
                  role="button"
                >
                  <td class="py-2 px-2 truncate max-w-[200px]" title={session.key}>
                    {session.label || session.key}
                  </td>
                  <td class="py-2 px-2 text-[var(--color-text-muted)] truncate max-w-[120px]">
                    {session.model || "-"}
                  </td>
                  <td class="py-2 px-2 text-right font-mono">
                    {formatTokenCount(session.usage.totalTokens)}
                  </td>
                  <td class="py-2 px-2 text-right font-mono">
                    {formatCost(session.usage.totalCost)}
                  </td>
                  <td class="py-2 px-2 text-right text-[var(--color-text-muted)]">
                    {session.lastActiveAt
                      ? formatTimestamp(new Date(session.lastActiveAt), { relative: true })
                      : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sortedSessions.length > 20 && (
        <div class="mt-3 text-center text-sm text-[var(--color-text-muted)]">
          Showing 20 of {sortedSessions.length} sessions
        </div>
      )}
    </Card>
  );
}

function SessionDetailPanel() {
  const session = selectedSession.value;

  if (!session) {
    return null;
  }

  const contextWeight = session.contextWeight;

  return (
    <Card padding="md">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="font-semibold">{t("usage.detail.title")}</h3>
          <p class="text-sm text-[var(--color-text-muted)] truncate max-w-md">
            {session.label || session.key}
          </p>
        </div>
        <IconButton
          icon={<X class="w-4 h-4" />}
          label="Close"
          onClick={() => {
            selectedSession.value = null;
          }}
          variant="ghost"
          size="sm"
        />
      </div>

      {/* Token breakdown */}
      <div class="grid grid-cols-4 gap-4 mb-4">
        <div>
          <div class="text-xs text-[var(--color-text-muted)]">{t("usage.summary.input")}</div>
          <div class="font-medium">{formatTokenCount(session.usage.input)}</div>
        </div>
        <div>
          <div class="text-xs text-[var(--color-text-muted)]">{t("usage.summary.output")}</div>
          <div class="font-medium">{formatTokenCount(session.usage.output)}</div>
        </div>
        <div>
          <div class="text-xs text-[var(--color-text-muted)]">{t("usage.summary.cacheRead")}</div>
          <div class="font-medium">{formatTokenCount(session.usage.cacheRead)}</div>
        </div>
        <div>
          <div class="text-xs text-[var(--color-text-muted)]">{t("usage.summary.totalCost")}</div>
          <div class="font-medium text-[var(--color-success)]">
            {formatCost(session.usage.totalCost)}
          </div>
        </div>
      </div>

      {/* Context weight breakdown */}
      {contextWeight && contextWeight.total > 0 && (
        <div class="pt-4 border-t border-[var(--color-border)]">
          <h4 class="text-sm font-medium mb-3">{t("usage.detail.contextWeight")}</h4>
          <div class="space-y-2">
            {contextWeight.systemPrompt != null && contextWeight.systemPrompt > 0 && (
              <ContextWeightBar
                label={t("usage.detail.system")}
                value={contextWeight.systemPrompt}
                total={contextWeight.total}
                color="var(--color-accent)"
              />
            )}
            {contextWeight.skills != null && contextWeight.skills > 0 && (
              <ContextWeightBar
                label={t("usage.detail.skills")}
                value={contextWeight.skills}
                total={contextWeight.total}
                color="var(--color-success)"
              />
            )}
            {contextWeight.tools != null && contextWeight.tools > 0 && (
              <ContextWeightBar
                label={t("usage.detail.tools")}
                value={contextWeight.tools}
                total={contextWeight.total}
                color="var(--color-warning)"
              />
            )}
            {contextWeight.files != null && contextWeight.files > 0 && (
              <ContextWeightBar
                label={t("usage.detail.files")}
                value={contextWeight.files}
                total={contextWeight.total}
                color="var(--color-info)"
              />
            )}
            {contextWeight.other != null && contextWeight.other > 0 && (
              <ContextWeightBar
                label={t("usage.detail.other")}
                value={contextWeight.other}
                total={contextWeight.total}
                color="var(--color-text-muted)"
              />
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function ContextWeightBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = Math.round((value / total) * 100);

  return (
    <div class="flex items-center gap-3">
      <div class="w-24 text-xs text-[var(--color-text-muted)]">{label}</div>
      <div class="flex-1 h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
        <div
          class="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div class="w-16 text-xs text-right">
        {formatTokenCount(value)} ({pct}%)
      </div>
    </div>
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
        <h3 class="font-semibold">{t("usage.agents.title")}</h3>
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
                  {t("usage.agents.default")}
                </Badge>
              )}
            </div>
            <div class="flex items-center gap-4 text-sm text-[var(--color-text-muted)]">
              <span>
                {agent.sessions.count} {t("usage.agents.sessions")}
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

export function UsageView(_props: RouteProps) {
  useEffect(() => {
    if (isConnected.value) {
      loadAll();
    }
  }, [isConnected.value]);

  return (
    <ViewErrorBoundary viewName={t("nav.usage")}>
      <div class="flex-1 overflow-y-auto p-6">
        <div class="max-w-4xl mx-auto space-y-6">
          <PageHeader
            title={t("usage.title")}
            subtitle={t("usage.description")}
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

              {/* Per-Session Usage */}
              <div class="md:col-span-2">
                <SessionUsageTable />
              </div>

              {/* Session Detail Panel */}
              {selectedSession.value && (
                <div class="md:col-span-2">
                  <SessionDetailPanel />
                </div>
              )}

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
    </ViewErrorBoundary>
  );
}
