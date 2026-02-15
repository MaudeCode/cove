/**
 * UsageView
 *
 * Token usage analytics and cost tracking.
 * Route: /usage
 */

import { signal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { t, formatTimestamp } from "@/lib/i18n";
import { send, isConnected } from "@/lib/gateway";
import { useQueryParam } from "@/hooks/useQueryParam";
import { getErrorMessage } from "@/lib/session-utils";
import { toast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { IconButton } from "@/components/ui/IconButton";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  RefreshCw,
  Clock,
  Zap,
  TrendingUp,
  Users,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
} from "lucide-preact";
import { PageLayout } from "@/components/ui/PageLayout";
import { ListCard } from "@/components/ui/ListCard";
import { Modal } from "@/components/ui/Modal";
import { GatewayInfoCard, UsageSummaryCard, DailyUsageChart, AgentsCard } from "@/components/usage";
import { getSessionsUsageCache, setSessionsUsageCache } from "@/lib/storage";
import type {
  CostUsageSummary,
  HealthSummary,
  SessionsUsageResult,
  SessionUsageEntry,
  SessionUsageTimeSeries,
  SessionLogsResult,
  SessionLogEntry,
} from "@/types/server-stats";
import { formatTokenCount, formatCost } from "@/types/server-stats";
import { Badge } from "@/components/ui/Badge";

import type { RouteProps } from "@/types/routes";

// ============================================
// Local State
// ============================================

const healthData = signal<HealthSummary | null>(null);
const usageData = signal<CostUsageSummary | null>(null);
const sessionsUsage = signal<SessionsUsageResult | null>(getSessionsUsageCache());
const selectedSession = signal<SessionUsageEntry | null>(null);
const isLoading = signal<boolean>(false);
const isLoadingUsage = signal<boolean>(false);
const isLoadingSessionsUsage = signal<boolean>(false);
const error = signal<string | null>(null);
const usageDays = signal<number>(30);
const sessionsSortBy = signal<"cost" | "tokens" | "recent">("recent");
const sessionsSortDesc = signal<boolean>(true);
const sessionsPage = signal<number>(0);
const sessionsPageSize = 5;

// Session detail modal state
type DetailTab = "overview" | "timeline" | "messages";
const detailTab = signal<DetailTab>("overview");
const sessionTimeseries = signal<SessionUsageTimeSeries | null>(null);
const sessionLogs = signal<SessionLogEntry[]>([]);
const isLoadingTimeseries = signal<boolean>(false);
const isLoadingLogs = signal<boolean>(false);

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
  if (isLoadingSessionsUsage.value) return; // Prevent duplicate calls
  isLoadingSessionsUsage.value = true;

  try {
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
    if (result) {
      setSessionsUsageCache(result);
    }
  } catch {
    // Keep cached data on error
    if (!sessionsUsage.value) {
      sessionsUsage.value = null;
    }
  } finally {
    isLoadingSessionsUsage.value = false;
  }
}

async function loadAll(): Promise<void> {
  await Promise.all([loadHealth(), loadUsage(usageDays.value)]);
}

async function loadSessionTimeseries(key: string): Promise<void> {
  if (isLoadingTimeseries.value) return;
  isLoadingTimeseries.value = true;
  sessionTimeseries.value = null;

  try {
    const result = await send<SessionUsageTimeSeries>("sessions.usage.timeseries", { key });
    sessionTimeseries.value = result;
  } catch {
    // Silently fail - timeseries might not be available
  } finally {
    isLoadingTimeseries.value = false;
  }
}

async function loadSessionLogs(key: string): Promise<void> {
  if (isLoadingLogs.value) return;
  isLoadingLogs.value = true;
  sessionLogs.value = [];

  try {
    const result = await send<SessionLogsResult>("sessions.usage.logs", { key, limit: 100 });
    sessionLogs.value = result?.logs ?? [];
  } catch {
    // Silently fail
  } finally {
    isLoadingLogs.value = false;
  }
}

function clearSessionDetail(): void {
  selectedSession.value = null;
  detailTab.value = "overview";
  sessionTimeseries.value = null;
  sessionLogs.value = [];
}

// ============================================
// ============================================
// Components
// ============================================

function SessionUsageTable() {
  const data = sessionsUsage.value;
  const selected = selectedSession.value;
  const isLoadingSessions = isLoadingSessionsUsage.value;

  // Show loading skeleton when no cached data
  if (!data && isLoadingSessions) {
    return (
      <Card padding="md">
        <div class="flex items-center gap-3 mb-4">
          <div class="p-2 rounded-lg bg-[var(--color-info)]/10">
            <Users class="w-5 h-5 text-[var(--color-info)]" />
          </div>
          <h3 class="font-semibold">{t("common.sessions")}</h3>
          <Spinner size="sm" />
        </div>
        <div class="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              class="animate-pulse flex items-center gap-3 p-3 rounded-lg bg-[var(--color-bg-secondary)]"
            >
              <div class="w-8 h-8 rounded-lg bg-[var(--color-bg-tertiary)]" />
              <div class="flex-1 space-y-2">
                <div class="h-4 bg-[var(--color-bg-tertiary)] rounded w-1/3" />
                <div class="h-3 bg-[var(--color-bg-tertiary)] rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (!data || data.sessions.length === 0) {
    return (
      <Card padding="md">
        <div class="flex items-center gap-3 mb-4">
          <div class="p-2 rounded-lg bg-[var(--color-info)]/10">
            <Users class="w-5 h-5 text-[var(--color-info)]" />
          </div>
          <h3 class="font-semibold">{t("common.sessions")}</h3>
        </div>
        <p class="text-sm text-[var(--color-text-muted)]">{t("usage.sessions.noData")}</p>
      </Card>
    );
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
      cmp = (a.updatedAt || 0) - (b.updatedAt || 0);
    }

    return desc ? -cmp : cmp;
  });

  const paginatedSessions = sortedSessions.slice(
    sessionsPage.value * sessionsPageSize,
    (sessionsPage.value + 1) * sessionsPageSize,
  );

  const toggleSort = (col: "cost" | "tokens" | "recent") => {
    if (sessionsSortBy.value === col) {
      sessionsSortDesc.value = !sessionsSortDesc.value;
    } else {
      sessionsSortBy.value = col;
      sessionsSortDesc.value = true;
    }
    sessionsPage.value = 0;
  };

  const SortIcon = ({ col }: { col: "cost" | "tokens" | "recent" }) => {
    if (sessionsSortBy.value !== col) return null;
    return sessionsSortDesc.value ? (
      <ChevronDown class="w-3 h-3 inline ml-1" />
    ) : (
      <ChevronUp class="w-3 h-3 inline ml-1" />
    );
  };

  const handleSessionClick = (session: SessionUsageEntry) => {
    selectedSession.value = selected?.key === session.key ? null : session;
  };

  const Pagination = () =>
    sortedSessions.length > sessionsPageSize ? (
      <div class="mt-4 flex items-center justify-between">
        <div class="text-sm text-[var(--color-text-muted)]">
          {t("usage.sessions.showing", {
            from: sessionsPage.value * sessionsPageSize + 1,
            to: Math.min((sessionsPage.value + 1) * sessionsPageSize, sortedSessions.length),
            total: sortedSessions.length,
          })}
        </div>
        <div class="flex items-center gap-1">
          <IconButton
            icon={<ChevronLeft class="w-4 h-4" />}
            label={t("actions.previous")}
            onClick={() => {
              sessionsPage.value = Math.max(0, sessionsPage.value - 1);
            }}
            disabled={sessionsPage.value === 0}
            variant="ghost"
            size="sm"
          />
          <span class="px-2 text-sm text-[var(--color-text-muted)]">
            {sessionsPage.value + 1} / {Math.ceil(sortedSessions.length / sessionsPageSize)}
          </span>
          <IconButton
            icon={<ChevronRight class="w-4 h-4" />}
            label={t("actions.next")}
            onClick={() => {
              sessionsPage.value = Math.min(
                Math.ceil(sortedSessions.length / sessionsPageSize) - 1,
                sessionsPage.value + 1,
              );
            }}
            disabled={sessionsPage.value >= Math.ceil(sortedSessions.length / sessionsPageSize) - 1}
            variant="ghost"
            size="sm"
          />
        </div>
      </div>
    ) : null;

  return (
    <>
      {/* Mobile: Card list */}
      <div class="md:hidden space-y-2 min-w-0 overflow-hidden">
        <div class="flex items-center gap-3 mb-3">
          <div class="p-2 rounded-lg bg-[var(--color-info)]/10">
            <Users class="w-5 h-5 text-[var(--color-info)]" />
          </div>
          <h3 class="font-semibold">{t("common.sessions")}</h3>
          {isLoadingSessions && <Spinner size="sm" />}
        </div>
        {paginatedSessions.map((session) => (
          <ListCard
            key={session.key}
            icon={MessageSquare}
            iconVariant={selected?.key === session.key ? "info" : "default"}
            title={session.label || session.key}
            subtitle={session.model || undefined}
            meta={[
              { icon: Zap, value: formatTokenCount(session.usage.totalTokens) },
              { icon: TrendingUp, value: formatCost(session.usage.totalCost) },
              ...(session.updatedAt
                ? [
                    {
                      icon: Clock,
                      value: formatTimestamp(new Date(session.updatedAt), { relative: true }),
                    },
                  ]
                : []),
            ]}
            onClick={() => handleSessionClick(session)}
          />
        ))}
        <Pagination />
      </div>

      {/* Desktop: Table */}
      <Card padding="md" class="hidden md:block">
        <div class="flex items-center gap-3 mb-4">
          <div class="p-2 rounded-lg bg-[var(--color-info)]/10">
            <Users class="w-5 h-5 text-[var(--color-info)]" />
          </div>
          <h3 class="font-semibold">{t("common.sessions")}</h3>
          {isLoadingSessions && <Spinner size="sm" />}
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-[var(--color-border)]">
                <th class="text-left py-2 px-2 font-medium text-[var(--color-text-muted)]">
                  {t("common.session")}
                </th>
                <th class="text-left py-2 px-2 font-medium text-[var(--color-text-muted)]">
                  {t("common.model")}
                </th>
                <th class="text-right py-2 px-2 font-medium">
                  <button
                    type="button"
                    class="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer"
                    onClick={() => toggleSort("tokens")}
                  >
                    {t("common.tokens")}
                    <SortIcon col="tokens" />
                  </button>
                </th>
                <th class="text-right py-2 px-2 font-medium">
                  <button
                    type="button"
                    class="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer"
                    onClick={() => toggleSort("cost")}
                  >
                    {t("usage.sessions.cost")}
                    <SortIcon col="cost" />
                  </button>
                </th>
                <th class="text-right py-2 px-2 font-medium">
                  <button
                    type="button"
                    class="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer"
                    onClick={() => toggleSort("recent")}
                  >
                    {t("common.lastActive")}
                    <SortIcon col="recent" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedSessions.map((session) => {
                const isSelected = selected?.key === session.key;
                return (
                  <tr
                    key={session.key}
                    class={`border-b border-[var(--color-border)] cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-[var(--color-accent)]/10"
                        : "hover:bg-[var(--color-bg-hover)]"
                    }`}
                    onClick={() => handleSessionClick(session)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSessionClick(session);
                      }
                    }}
                    tabIndex={0}
                    aria-label={t("usage.sessions.viewDetails", {
                      name: session.label || session.key,
                    })}
                  >
                    <td class="py-2 px-2 truncate max-w-[200px]" title={session.key}>
                      {session.label || session.key}
                    </td>
                    <td
                      class="py-2 px-2 text-[var(--color-text-muted)] truncate max-w-[120px]"
                      title={session.model || undefined}
                    >
                      {session.model || "-"}
                    </td>
                    <td class="py-2 px-2 text-right font-mono">
                      {formatTokenCount(session.usage.totalTokens)}
                    </td>
                    <td class="py-2 px-2 text-right font-mono">
                      {formatCost(session.usage.totalCost)}
                    </td>
                    <td class="py-2 px-2 text-right text-[var(--color-text-muted)]">
                      {session.updatedAt
                        ? formatTimestamp(new Date(session.updatedAt), { relative: true })
                        : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Pagination />
      </Card>
    </>
  );
}

function SessionDetailModal() {
  const session = selectedSession.value;
  const tab = detailTab.value;

  // Load data when tab changes
  useEffect(() => {
    if (!session) return;
    if (tab === "timeline" && !sessionTimeseries.value && !isLoadingTimeseries.value) {
      loadSessionTimeseries(session.key);
    } else if (tab === "messages" && sessionLogs.value.length === 0 && !isLoadingLogs.value) {
      loadSessionLogs(session.key);
    }
  }, [session, tab]);

  const tabs: { id: DetailTab; label: string }[] = [
    { id: "overview", label: t("common.overview") },
    { id: "timeline", label: t("usage.detail.tabs.timeline") },
    { id: "messages", label: t("usage.detail.tabs.messages") },
  ];

  return (
    <Modal open={!!session} onClose={clearSessionDetail} title={t("common.sessionDetails")}>
      {session && (
        <div class="space-y-4">
          {/* Session name */}
          <p class="text-sm text-[var(--color-text-muted)] truncate -mt-2">
            {session.label || session.key}
          </p>

          {/* Tabs */}
          <div class="flex gap-1 border-b border-[var(--color-border)]" role="tablist">
            {tabs.map((tabItem) => (
              <button
                key={tabItem.id}
                type="button"
                role="tab"
                aria-selected={tab === tabItem.id}
                onClick={() => {
                  detailTab.value = tabItem.id;
                }}
                class={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  tab === tabItem.id
                    ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                    : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                {tabItem.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div role="tabpanel">
            {tab === "overview" && <OverviewTab session={session} />}
            {tab === "timeline" && <TimelineTab />}
            {tab === "messages" && <MessagesTab />}
          </div>
        </div>
      )}
    </Modal>
  );
}

function OverviewTab({ session }: { session: SessionUsageEntry }) {
  const contextWeight = session.contextWeight;

  return (
    <div class="space-y-4">
      {/* Token breakdown */}
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <div class="text-xs text-[var(--color-text-muted)]">{t("common.input")}</div>
          <div class="font-medium">{formatTokenCount(session.usage.input)}</div>
        </div>
        <div>
          <div class="text-xs text-[var(--color-text-muted)]">{t("common.output")}</div>
          <div class="font-medium">{formatTokenCount(session.usage.output)}</div>
        </div>
        <div>
          <div class="text-xs text-[var(--color-text-muted)]">{t("usage.summary.cacheRead")}</div>
          <div class="font-medium">{formatTokenCount(session.usage.cacheRead)}</div>
        </div>
        <div>
          <div class="text-xs text-[var(--color-text-muted)]">{t("common.totalCost")}</div>
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
                label={t("common.skills")}
                value={contextWeight.skills}
                total={contextWeight.total}
                color="var(--color-success)"
              />
            )}
            {contextWeight.tools != null && contextWeight.tools > 0 && (
              <ContextWeightBar
                label={t("common.tools")}
                value={contextWeight.tools}
                total={contextWeight.total}
                color="var(--color-warning)"
              />
            )}
            {contextWeight.files != null && contextWeight.files > 0 && (
              <ContextWeightBar
                label={t("common.files")}
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
    </div>
  );
}

function TimelineTab() {
  const timeseries = sessionTimeseries.value;
  const isLoading = isLoadingTimeseries.value;

  if (isLoading) {
    return (
      <div class="flex justify-center py-8">
        <Spinner size="md" />
      </div>
    );
  }

  if (!timeseries || timeseries.points.length === 0) {
    return (
      <p class="text-sm text-[var(--color-text-muted)] py-4 text-center">
        {t("usage.detail.noTimeline")}
      </p>
    );
  }

  const points = timeseries.points;
  const maxTokens = Math.max(...points.map((p) => p.cumulativeTokens));
  const maxCost = Math.max(...points.map((p) => p.cumulativeCost));

  // Simple area chart using SVG
  const width = 400;
  const height = 120;
  const padding = { top: 10, right: 10, bottom: 20, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const xScale = (i: number) => padding.left + (i / (points.length - 1)) * chartWidth;
  const yScaleTokens = (v: number) =>
    padding.top + chartHeight - (v / (maxTokens || 1)) * chartHeight;

  const tokenPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(i)} ${yScaleTokens(p.cumulativeTokens)}`)
    .join(" ");

  const areaPath = `${tokenPath} L ${xScale(points.length - 1)} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`;

  return (
    <div class="space-y-3">
      <div class="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
        <span>{t("usage.detail.cumulativeTokens")}</span>
        <span>{formatTokenCount(maxTokens)} max</span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} class="w-full h-auto">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
          <line
            key={pct}
            x1={padding.left}
            y1={padding.top + chartHeight * (1 - pct)}
            x2={width - padding.right}
            y2={padding.top + chartHeight * (1 - pct)}
            stroke="var(--color-border)"
            stroke-dasharray="2,2"
          />
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="var(--color-accent)" opacity="0.2" />

        {/* Line */}
        <path d={tokenPath} fill="none" stroke="var(--color-accent)" stroke-width="2" />

        {/* X-axis labels */}
        <text
          x={padding.left}
          y={height - 2}
          font-size="10"
          fill="var(--color-text-muted)"
          text-anchor="start"
        >
          {formatTimestamp(new Date(points[0].timestamp), { relative: false })}
        </text>
        <text
          x={width - padding.right}
          y={height - 2}
          font-size="10"
          fill="var(--color-text-muted)"
          text-anchor="end"
        >
          {formatTimestamp(new Date(points[points.length - 1].timestamp), { relative: false })}
        </text>
      </svg>

      {/* Summary stats */}
      <div class="grid grid-cols-3 gap-4 pt-2 border-t border-[var(--color-border)]">
        <div class="text-center">
          <div class="text-lg font-semibold">{points.length}</div>
          <div class="text-xs text-[var(--color-text-muted)]">{t("usage.detail.requests")}</div>
        </div>
        <div class="text-center">
          <div class="text-lg font-semibold">{formatTokenCount(maxTokens)}</div>
          <div class="text-xs text-[var(--color-text-muted)]">{t("usage.detail.totalTokens")}</div>
        </div>
        <div class="text-center">
          <div class="text-lg font-semibold text-[var(--color-success)]">{formatCost(maxCost)}</div>
          <div class="text-xs text-[var(--color-text-muted)]">{t("common.totalCost")}</div>
        </div>
      </div>
    </div>
  );
}

function MessagesTab() {
  const logs = sessionLogs.value;
  const isLoading = isLoadingLogs.value;

  if (isLoading) {
    return (
      <div class="flex justify-center py-8">
        <Spinner size="md" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <p class="text-sm text-[var(--color-text-muted)] py-4 text-center">
        {t("usage.detail.noMessages")}
      </p>
    );
  }

  const roleColors: Record<string, string> = {
    user: "info",
    assistant: "success",
    tool: "warning",
    toolResult: "default",
  };

  const roleLabels: Record<string, string> = {
    user: t("usage.detail.role.user"),
    assistant: t("common.assistant"),
    tool: t("usage.detail.role.tool"),
    toolResult: t("common.result"),
  };

  return (
    <div class="space-y-2 max-h-[300px] overflow-y-auto">
      {logs.map((log, i) => (
        <div
          key={i}
          class="p-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
        >
          <div class="flex items-center justify-between gap-2 mb-1">
            <div class="flex items-center gap-2">
              <Badge variant={roleColors[log.role] as "info" | "success" | "warning" | "default"}>
                {roleLabels[log.role] || log.role}
              </Badge>
              {log.tokens != null && (
                <span class="text-xs text-[var(--color-text-muted)]">
                  {t("usage.detail.tokenCount", { count: formatTokenCount(log.tokens) })}
                </span>
              )}
            </div>
            <span class="text-xs text-[var(--color-text-muted)]">
              {formatTimestamp(new Date(log.timestamp), { relative: true })}
            </span>
          </div>
          <p class="text-sm text-[var(--color-text-secondary)] line-clamp-2">{log.content}</p>
        </div>
      ))}
    </div>
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

// ============================================
// Main View
// ============================================

export function UsageView(_props: RouteProps) {
  // URL query params
  const sessionsReady = sessionsUsage.value !== null && sessionsUsage.value.sessions.length > 0;
  const [sessionParam, setSessionParam, sessionParamInitialized] = useQueryParam("session", {
    ready: sessionsReady,
  });

  // Sync URL → selected session
  useEffect(() => {
    if (sessionsReady && sessionParam.value) {
      const session = sessionsUsage.value?.sessions.find((s) => s.key === sessionParam.value);
      if (session && selectedSession.value?.key !== session.key) {
        selectedSession.value = session;
      }
    }
  }, [sessionParam.value, sessionsReady]);

  // Sync selected session → URL
  useEffect(() => {
    if (sessionParamInitialized.value) {
      setSessionParam(selectedSession.value?.key ?? null);
    }
  }, [selectedSession.value, sessionParamInitialized.value]);

  useEffect(() => {
    if (isConnected.value) {
      loadAll();
    }
  }, [isConnected.value]);

  return (
    <PageLayout viewName={t("common.usage")}>
      <PageHeader
        title={t("common.usage")}
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
          <GatewayInfoCard healthData={healthData.value} />

          {/* Usage Summary */}
          <UsageSummaryCard usage={usageData.value} isLoading={isLoadingUsage.value} />

          {/* Daily Usage Chart */}
          <div class="md:col-span-2">
            <DailyUsageChart usage={usageData.value} />
          </div>

          {/* Per-Session Usage */}
          <div class="md:col-span-2 min-w-0">
            <SessionUsageTable />
          </div>

          {/* Agents */}
          <div class="md:col-span-2">
            <AgentsCard healthData={healthData.value} />
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

      {/* Session Detail Modal */}
      <SessionDetailModal />
    </PageLayout>
  );
}
