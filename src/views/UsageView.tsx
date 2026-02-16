/**
 * UsageView
 *
 * Token usage analytics and cost tracking.
 * Route: /usage
 */

import { t } from "@/lib/i18n";
import { isConnected } from "@/lib/gateway";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { IconButton } from "@/components/ui/IconButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { RefreshCw } from "lucide-preact";
import { PageLayout } from "@/components/ui/PageLayout";
import { GatewayInfoCard, UsageSummaryCard, DailyUsageChart, AgentsCard } from "@/components/usage";
import { UsageSessionTable } from "@/views/usage/UsageSessionTable";
import { UsageSessionDetailModal } from "@/views/usage/UsageSessionDetailModal";
import {
  healthData,
  usageData,
  isLoading,
  error,
  usageDays,
  isLoadingUsage,
  loadAll,
  loadUsage,
  useUsageViewQuerySync,
  useUsageViewInitialLoad,
} from "@/views/usage/useUsageViewState";
import type { RouteProps } from "@/types/routes";

export function UsageView(_props: RouteProps) {
  useUsageViewQuerySync();
  useUsageViewInitialLoad();

  return (
    <PageLayout viewName={t("common.usage")}>
      <PageHeader
        title={t("common.usage")}
        subtitle={t("usage.description")}
        actions={
          <IconButton
            icon={<RefreshCw class={`w-4 h-4 ${isLoading.value ? "animate-spin" : ""}`} />}
            label={t("actions.refresh")}
            onClick={() => {
              void loadAll();
            }}
            disabled={isLoading.value || !isConnected.value}
            variant="ghost"
          />
        }
      />

      {error.value && (
        <div class="p-4 rounded-xl bg-[var(--color-error)]/10 text-[var(--color-error)]">
          {error.value}
        </div>
      )}

      {(isLoading.value && !healthData.value) || !isConnected.value ? (
        <div class="flex justify-center py-16">
          <Spinner size="lg" label={!isConnected.value ? t("status.connecting") : undefined} />
        </div>
      ) : (
        <div class="grid gap-6 md:grid-cols-2">
          <GatewayInfoCard healthData={healthData.value} />
          <UsageSummaryCard usage={usageData.value} isLoading={isLoadingUsage.value} />
          <div class="md:col-span-2">
            <DailyUsageChart usage={usageData.value} />
          </div>
          <div class="md:col-span-2 min-w-0">
            <UsageSessionTable />
          </div>
          <div class="md:col-span-2">
            <AgentsCard healthData={healthData.value} />
          </div>
        </div>
      )}

      {usageData.value && (
        <div class="flex justify-center gap-2">
          {[7, 14, 30, 90].map((days) => (
            <Button
              key={days}
              variant={usageDays.value === days ? "primary" : "ghost"}
              size="sm"
              onClick={() => {
                void loadUsage(days);
              }}
              disabled={isLoadingUsage.value}
            >
              {days}d
            </Button>
          ))}
        </div>
      )}

      <UsageSessionDetailModal />
    </PageLayout>
  );
}
