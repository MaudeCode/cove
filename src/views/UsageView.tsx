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
import { ViewErrorBoundary } from "@/components/ui/ViewErrorBoundary";
import { ListCard } from "@/components/ui/ListCard";
import { Modal } from "@/components/ui/Modal";
import { GatewayInfoCard, UsageSummaryCard, DailyUsageChart, AgentsCard } from "@/components/usage";
import { getSessionsUsageCache, setSessionsUsageCache } from "@/lib/storage";
import type {
  CostUsageSummary,
  HealthSummary,
  SessionsUsageResult,
  SessionUsageEntry,
} from "@/types/server-stats";
import { formatTokenCount, formatCost } from "@/types/server-stats";

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
          <h3 class="font-semibold">{t("usage.sessions.title")}</h3>
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
          <h3 class="font-semibold">{t("usage.sessions.title")}</h3>
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
          <h3 class="font-semibold">{t("usage.sessions.title")}</h3>
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
          <h3 class="font-semibold">{t("usage.sessions.title")}</h3>
          {isLoadingSessions && <Spinner size="sm" />}
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
                <th class="text-right py-2 px-2 font-medium">
                  <button
                    type="button"
                    class="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer"
                    onClick={() => toggleSort("tokens")}
                  >
                    {t("usage.sessions.tokens")}
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
                    {t("usage.sessions.lastActive")}
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
  const contextWeight = session?.contextWeight;

  return (
    <Modal
      open={!!session}
      onClose={() => {
        selectedSession.value = null;
      }}
      title={t("usage.detail.title")}
    >
      {session && (
        <div class="space-y-4">
          {/* Session name */}
          <p class="text-sm text-[var(--color-text-muted)] truncate -mt-2">
            {session.label || session.key}
          </p>

          {/* Token breakdown */}
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <div class="text-xs text-[var(--color-text-muted)]">{t("usage.summary.input")}</div>
              <div class="font-medium">{formatTokenCount(session.usage.input)}</div>
            </div>
            <div>
              <div class="text-xs text-[var(--color-text-muted)]">{t("usage.summary.output")}</div>
              <div class="font-medium">{formatTokenCount(session.usage.output)}</div>
            </div>
            <div>
              <div class="text-xs text-[var(--color-text-muted)]">
                {t("usage.summary.cacheRead")}
              </div>
              <div class="font-medium">{formatTokenCount(session.usage.cacheRead)}</div>
            </div>
            <div>
              <div class="text-xs text-[var(--color-text-muted)]">
                {t("usage.summary.totalCost")}
              </div>
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
        </div>
      )}
    </Modal>
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
  useEffect(() => {
    if (isConnected.value) {
      loadAll();
    }
  }, [isConnected.value]);

  return (
    <ViewErrorBoundary viewName={t("nav.usage")}>
      <div class="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
        <div class="max-w-4xl mx-auto space-y-6 min-w-0">
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
        </div>
      </div>

      {/* Session Detail Modal */}
      <SessionDetailModal />
    </ViewErrorBoundary>
  );
}
