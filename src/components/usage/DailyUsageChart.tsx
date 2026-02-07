/**
 * DailyUsageChart
 *
 * Displays daily token usage as horizontal bar chart.
 */

import { t } from "@/lib/i18n";
import { Card } from "@/components/ui/Card";
import { Calendar } from "lucide-preact";
import { formatTokenCount } from "@/types/server-stats";
import type { CostUsageSummary } from "@/types/server-stats";

interface DailyUsageChartProps {
  usage: CostUsageSummary | null;
}

export function DailyUsageChart({ usage }: DailyUsageChartProps) {
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
