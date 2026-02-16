import { t, formatTimestamp } from "@/lib/i18n";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { IconButton } from "@/components/ui/IconButton";
import { ListCard } from "@/components/ui/ListCard";
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, MessageSquare, Clock, Zap, TrendingUp, Users } from "lucide-preact";
import { formatTokenCount, formatCost, type SessionUsageEntry } from "@/types/server-stats";
import {
  sessionsUsage,
  selectedSession,
  isLoadingSessionsUsage,
  sessionsSortBy,
  sessionsSortDesc,
  sessionsPage,
  sessionsPageSize,
} from "@/views/usage/useUsageViewState";

export function UsageSessionTable() {
  const data = sessionsUsage.value;
  const selected = selectedSession.value;
  const isLoadingSessions = isLoadingSessionsUsage.value;

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
                      isSelected ? "bg-[var(--color-accent)]/10" : "hover:bg-[var(--color-bg-hover)]"
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
