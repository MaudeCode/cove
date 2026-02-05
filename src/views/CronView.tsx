/**
 * CronView
 *
 * Cron job management with table layout, create/edit modals.
 * Route: /cron
 */

import { t, formatTimestamp } from "@/lib/i18n";
import { isConnected } from "@/lib/gateway";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { IconButton } from "@/components/ui/IconButton";
import { StatCard } from "@/components/ui/StatCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { ViewErrorBoundary } from "@/components/ui/ViewErrorBoundary";
import { CronJobRow, CronJobCard, CronJobModal } from "@/components/cron";
import { useCronJobs } from "@/hooks/useCronJobs";
import { RefreshCw, Search, Plus, Clock, CheckCircle, XCircle, Zap } from "lucide-preact";
import type { RouteProps } from "@/types/routes";

export function CronView(_props: RouteProps) {
  const {
    // State
    cronJobs,
    cronStatus,
    isLoading,
    error,
    searchQuery,
    statusFilter,
    // Modal state
    modalMode,
    selectedJob,
    selectedJobRuns,
    isLoadingRuns,
    isDeleting,
    isSaving,
    isRunning,
    // Form signals
    editName,
    editDescription,
    editEnabled,
    editScheduleKind,
    editScheduleExpr,
    editScheduleTz,
    editScheduleEveryMs,
    editScheduleAtMs,
    editWakeMode,
    editSessionTarget,
    editPayloadText,
    editPayloadMessage,
    editPayloadModel,
    formErrors,
    // Computed
    filteredJobs,
    jobCounts,
    hasFormChanges,
    // Actions
    loadCronJobs,
    openJobModal,
    closeModal,
    saveOrCreateJob,
    deleteJob,
    runJobNow,
    toggleJobEnabled,
  } = useCronJobs();

  const counts = jobCounts.value;

  return (
    <ViewErrorBoundary viewName={t("nav.cron")}>
      <div class="flex-1 overflow-y-auto p-4 sm:p-6">
        <div class="max-w-5xl mx-auto space-y-4 sm:space-y-6">
          <PageHeader
            title={t("cron.title")}
            subtitle={t("cron.description")}
            actions={
              <>
                {isConnected.value && !isLoading.value && cronJobs.value.length > 0 && (
                  <div class="relative hidden sm:block">
                    <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                    <Input
                      type="text"
                      value={searchQuery.value}
                      onInput={(e) => (searchQuery.value = (e.target as HTMLInputElement).value)}
                      placeholder={t("cron.searchPlaceholder")}
                      aria-label={t("cron.searchPlaceholder")}
                      class="pl-10 w-64"
                    />
                  </div>
                )}
                <Button
                  icon={<Plus class="w-4 h-4" />}
                  onClick={() => openJobModal("create")}
                  disabled={!isConnected.value}
                >
                  <span class="hidden sm:inline">{t("cron.createJob")}</span>
                  <span class="sm:hidden">{t("actions.new")}</span>
                </Button>
                <IconButton
                  icon={<RefreshCw class={`w-4 h-4 ${isLoading.value ? "animate-spin" : ""}`} />}
                  label={t("actions.refresh")}
                  onClick={loadCronJobs}
                  disabled={isLoading.value || !isConnected.value}
                  variant="ghost"
                />
              </>
            }
          />

          {/* Mobile Search */}
          {isConnected.value && !isLoading.value && cronJobs.value.length > 0 && (
            <div class="relative sm:hidden">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
              <Input
                type="text"
                value={searchQuery.value}
                onInput={(e) => (searchQuery.value = (e.target as HTMLInputElement).value)}
                placeholder={t("cron.searchPlaceholder")}
                aria-label={t("cron.searchPlaceholder")}
                class="pl-10"
                fullWidth
              />
            </div>
          )}

          {/* Stats Cards */}
          {isConnected.value && !isLoading.value && (
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <StatCard
                icon={Clock}
                label={t("cron.stats.total")}
                value={counts.total}
                active={statusFilter.value === "all"}
                onClick={() => (statusFilter.value = "all")}
              />
              <StatCard
                icon={CheckCircle}
                label={t("cron.stats.enabled")}
                value={counts.enabled}
                active={statusFilter.value === "enabled"}
                onClick={() => (statusFilter.value = "enabled")}
              />
              <StatCard
                icon={XCircle}
                label={t("cron.stats.disabled")}
                value={counts.disabled}
                active={statusFilter.value === "disabled"}
                onClick={() => (statusFilter.value = "disabled")}
              />
              <StatCard
                icon={Zap}
                label={t("cron.stats.nextWake")}
                value={
                  cronStatus.value?.nextWakeAtMs
                    ? formatTimestamp(cronStatus.value.nextWakeAtMs, { relative: true })
                    : "—"
                }
              />
            </div>
          )}

          {/* Error */}
          {error.value && (
            <div
              class="p-4 rounded-xl bg-[var(--color-error)]/10 text-[var(--color-error)]"
              role="alert"
            >
              {error.value}
            </div>
          )}

          {/* Loading / Connecting */}
          {(isLoading.value || !isConnected.value) && (
            <div class="flex justify-center py-16">
              <Spinner size="lg" label={!isConnected.value ? t("status.connecting") : undefined} />
            </div>
          )}

          {/* Jobs - Cards on mobile, Table on desktop */}
          {isConnected.value && !isLoading.value && filteredJobs.value.length > 0 && (
            <>
              {/* Mobile: Card list (tap to edit) */}
              <div class="md:hidden space-y-2">
                {filteredJobs.value.map((job) => (
                  <CronJobCard key={job.id} job={job} onEdit={openJobModal.bind(null, "edit")} />
                ))}
              </div>

              {/* Desktop: Table */}
              <Card padding="none" class="hidden md:block">
                <table class="w-full">
                  <thead>
                    <tr class="border-b border-[var(--color-border)] text-left text-sm text-[var(--color-text-muted)]">
                      <th class="py-3 px-4 font-medium">{t("cron.columns.job")}</th>
                      <th class="py-3 px-4 font-medium w-40">{t("cron.columns.schedule")}</th>
                      <th class="py-3 px-4 font-medium w-24">{t("cron.columns.target")}</th>
                      <th class="py-3 px-4 font-medium w-32">{t("cron.columns.nextRun")}</th>
                      <th class="py-3 px-4 font-medium w-24">{t("cron.columns.status")}</th>
                      <th class="py-3 px-4 font-medium w-20"></th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-[var(--color-border)]">
                    {filteredJobs.value.map((job) => (
                      <CronJobRow
                        key={job.id}
                        job={job}
                        onEdit={openJobModal.bind(null, "edit")}
                        onRun={runJobNow}
                        onToggleEnabled={toggleJobEnabled}
                        isRunning={isRunning.value}
                      />
                    ))}
                  </tbody>
                </table>
              </Card>
            </>
          )}

          {/* Empty state */}
          {isConnected.value && !isLoading.value && cronJobs.value.length === 0 && !error.value && (
            <Card>
              <div class="p-16 text-center">
                <Clock class="w-12 h-12 mx-auto mb-4 text-[var(--color-text-muted)] opacity-50" />
                <h3 class="text-lg font-medium mb-2">{t("cron.emptyTitle")}</h3>
                <p class="text-[var(--color-text-muted)] mb-4">{t("cron.emptyDescription")}</p>
                <Button icon={<Plus class="w-4 h-4" />} onClick={() => openJobModal("create")}>
                  {t("cron.createJob")}
                </Button>
              </div>
            </Card>
          )}

          {/* No results from filter */}
          {isConnected.value &&
            !isLoading.value &&
            cronJobs.value.length > 0 &&
            filteredJobs.value.length === 0 && (
              <Card>
                <div class="p-12 text-center">
                  <Search class="w-10 h-10 mx-auto mb-4 text-[var(--color-text-muted)] opacity-50" />
                  <h3 class="text-lg font-medium mb-2">{t("cron.noResults")}</h3>
                  <p class="text-[var(--color-text-muted)] mb-4">
                    {t("cron.noResultsDescription")}
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      searchQuery.value = "";
                      statusFilter.value = "all";
                    }}
                  >
                    {t("cron.clearFilters")}
                  </Button>
                </div>
              </Card>
            )}

          {/* Footer count */}
          {isConnected.value && !isLoading.value && filteredJobs.value.length > 0 && (
            <p class="text-sm text-[var(--color-text-muted)] text-center">
              {filteredJobs.value.length === cronJobs.value.length
                ? t("cron.count", { count: cronJobs.value.length })
                : t("cron.filteredCount", {
                    filtered: filteredJobs.value.length,
                    total: cronJobs.value.length,
                  })}
            </p>
          )}
        </div>

        {/* Modal */}
        <CronJobModal
          mode={modalMode.value}
          job={selectedJob.value}
          runs={selectedJobRuns.value}
          isLoadingRuns={isLoadingRuns.value}
          isDeleting={isDeleting.value}
          isSaving={isSaving.value}
          isRunning={isRunning.value}
          hasChanges={hasFormChanges.value}
          onClose={closeModal}
          onSave={saveOrCreateJob}
          onDelete={deleteJob}
          onRun={runJobNow}
          onSetDeleting={(v) => (isDeleting.value = v)}
          editName={editName}
          editDescription={editDescription}
          editEnabled={editEnabled}
          editScheduleKind={editScheduleKind}
          editScheduleExpr={editScheduleExpr}
          editScheduleTz={editScheduleTz}
          editScheduleEveryMs={editScheduleEveryMs}
          editScheduleAtMs={editScheduleAtMs}
          editSessionTarget={editSessionTarget}
          editWakeMode={editWakeMode}
          editPayloadText={editPayloadText}
          editPayloadMessage={editPayloadMessage}
          editPayloadModel={editPayloadModel}
          formErrors={formErrors}
        />
      </div>
    </ViewErrorBoundary>
  );
}
