/**
 * UsageSummaryCard
 *
 * Displays aggregate token usage and cost summary.
 */

import { t } from "@/lib/i18n";
import { Card } from "@/components/ui/Card";
import { TrendingUp } from "lucide-preact";
import { formatTokenCount, formatCost } from "@/types/server-stats";
import type { CostUsageSummary } from "@/types/server-stats";

interface UsageSummaryCardProps {
  usage: CostUsageSummary | null;
  isLoading: boolean;
}

export function UsageSummaryCard({ usage, isLoading }: UsageSummaryCardProps) {
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
          {isLoading ? t("status.loading") : t("usage.summary.unavailable")}
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
