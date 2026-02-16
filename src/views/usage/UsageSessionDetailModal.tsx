import { useEffect } from "preact/hooks";
import { t, formatTimestamp } from "@/lib/i18n";
import { Spinner } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { TabNav } from "@/components/ui/TabNav";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import type { SessionUsageEntry, SessionLogEntry } from "@/types/server-stats";
import { formatTokenCount, formatCost } from "@/types/server-stats";
import {
  clearSessionDetail,
  detailTab,
  selectedSession,
  sessionTimeseries,
  sessionLogs,
  isLoadingTimeseries,
  isLoadingLogs,
  loadSessionTimeseries,
  loadSessionLogs,
  type DetailTab,
} from "@/views/usage/useUsageViewState";

export function UsageSessionDetailModal() {
  const session = selectedSession.value;
  const tab = detailTab.value;

  useEffect(() => {
    if (!session) return;
    if (tab === "timeline" && !sessionTimeseries.value && !isLoadingTimeseries.value) {
      void loadSessionTimeseries(session.key);
    } else if (tab === "messages" && sessionLogs.value.length === 0 && !isLoadingLogs.value) {
      void loadSessionLogs(session.key);
    }
  }, [session, tab]);

  const tabs: { id: DetailTab; label: string }[] = [
    { id: "overview", label: t("common.overview") },
    { id: "timeline", label: t("usage.detail.tabs.timeline") },
    { id: "messages", label: t("usage.detail.tabs.messages") },
  ];

  const handleTabChange = (id: string) => {
    if (id === "overview" || id === "timeline" || id === "messages") {
      detailTab.value = id;
    }
  };

  return (
    <Modal open={!!session} onClose={clearSessionDetail} title={t("common.sessionDetails")}>
      {session && (
        <div class="space-y-4">
          <p class="text-sm text-[var(--color-text-muted)] truncate -mt-2">{session.label || session.key}</p>
          <TabNav items={tabs} activeId={tab} onChange={handleTabChange} />
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
          <div class="font-medium text-[var(--color-success)]">{formatCost(session.usage.totalCost)}</div>
        </div>
      </div>

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
  const loading = isLoadingTimeseries.value;

  if (loading) {
    return (
      <div class="flex justify-center py-8">
        <Spinner size="md" />
      </div>
    );
  }

  if (!timeseries || timeseries.points.length === 0) {
    return (
      <p class="text-sm text-[var(--color-text-muted)] py-4 text-center">{t("usage.detail.noTimeline")}</p>
    );
  }

  const points = timeseries.points;
  const maxTokens = Math.max(...points.map((p) => p.cumulativeTokens));
  const maxCost = Math.max(...points.map((p) => p.cumulativeCost));

  const width = 400;
  const height = 120;
  const padding = { top: 10, right: 10, bottom: 20, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const xScale = (i: number) => padding.left + (i / (points.length - 1)) * chartWidth;
  const yScaleTokens = (v: number) => padding.top + chartHeight - (v / (maxTokens || 1)) * chartHeight;

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

        <path d={areaPath} fill="var(--color-accent)" opacity="0.2" />
        <path d={tokenPath} fill="none" stroke="var(--color-accent)" stroke-width="2" />

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
  const loading = isLoadingLogs.value;

  if (loading) {
    return (
      <div class="flex justify-center py-8">
        <Spinner size="md" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <p class="text-sm text-[var(--color-text-muted)] py-4 text-center">{t("usage.detail.noMessages")}</p>
    );
  }

  const roleColors: Record<SessionLogEntry["role"], NonNullable<BadgeProps["variant"]>> = {
    user: "info",
    assistant: "success",
    tool: "warning",
    toolResult: "default",
  };

  const roleLabels: Record<SessionLogEntry["role"], string> = {
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
              <Badge variant={roleColors[log.role]}>{roleLabels[log.role]}</Badge>
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
        <div class="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <div class="w-16 text-xs text-right">
        {formatTokenCount(value)} ({pct}%)
      </div>
    </div>
  );
}
