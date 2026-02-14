/**
 * CronView
 *
 * Cron job management with table layout, create/edit modals.
 * Route: /cron
 */

import { useEffect } from "preact/hooks";
import { t, formatTimestamp } from "@/lib/i18n";
import { isConnected } from "@/lib/gateway";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { IconButton } from "@/components/ui/IconButton";
import { StatCard } from "@/components/ui/StatCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageLayout } from "@/components/ui/PageLayout";
import { CronJobRow, CronJobCard, CronJobModal } from "@/components/cron";
import { useCronJobs } from "@/hooks/useCronJobs";
import { RefreshCw, Search, Plus, Clock, CheckCircle, XCircle, Zap } from "lucide-preact";
import type { RouteProps } from "@/types/routes";

export function CronView(_props: RouteProps) {
  const { state, modal, form, computed, actions } = useCronJobs();

  // Handle deep link: ?job=jobId opens the edit modal
  useEffect(() => {
    if (!state.isLoading.value && state.cronJobs.value.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const jobId = params.get("job");
      if (jobId) {
        const job = state.cronJobs.value.find((j) => j.id === jobId);
        if (job) {
          actions.openJobModal("edit", job);
        }
        // Clear the query param to avoid re-triggering
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, [state.isLoading.value, state.cronJobs.value]);

  const counts = computed.jobCounts.value;

  return (
    <PageLayout viewName={t("common.cronJobs")}>
      <PageHeader
        title={t("common.cronJobs")}
        subtitle={t("cron.description")}
        actions={
          <>
            {isConnected.value && !state.isLoading.value && state.cronJobs.value.length > 0 && (
              <div class="relative hidden sm:block">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                <Input
                  type="text"
                  value={state.searchQuery.value}
                  onInput={(e) => (state.searchQuery.value = (e.target as HTMLInputElement).value)}
                  placeholder={t("cron.searchPlaceholder")}
                  aria-label={t("cron.searchPlaceholder")}
                  class="pl-10 w-64"
                />
              </div>
            )}
            <Button
              icon={<Plus class="w-4 h-4" />}
              onClick={() => actions.openJobModal("create")}
              disabled={!isConnected.value}
            >
              <span class="hidden sm:inline">{t("cron.createJob")}</span>
              <span class="sm:hidden">{t("actions.new")}</span>
            </Button>
            <IconButton
              icon={<RefreshCw class={`w-4 h-4 ${state.isLoading.value ? "animate-spin" : ""}`} />}
              label={t("actions.refresh")}
              onClick={actions.loadCronJobs}
              disabled={state.isLoading.value || !isConnected.value}
              variant="ghost"
            />
          </>
        }
      />

      {/* Mobile Search */}
      {isConnected.value && !state.isLoading.value && state.cronJobs.value.length > 0 && (
        <div class="relative sm:hidden">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <Input
            type="text"
            value={state.searchQuery.value}
            onInput={(e) => (state.searchQuery.value = (e.target as HTMLInputElement).value)}
            placeholder={t("cron.searchPlaceholder")}
            aria-label={t("cron.searchPlaceholder")}
            class="pl-10"
            fullWidth
          />
        </div>
      )}

      {/* Stats Cards */}
      {isConnected.value && !state.isLoading.value && (
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
          <StatCard
            icon={Clock}
            label={t("common.total")}
            value={counts.total}
            active={state.statusFilter.value === "all"}
            onClick={() => (state.statusFilter.value = "all")}
          />
          <StatCard
            icon={CheckCircle}
            label={t("common.enabled")}
            value={counts.enabled}
            active={state.statusFilter.value === "enabled"}
            onClick={() => (state.statusFilter.value = "enabled")}
          />
          <StatCard
            icon={XCircle}
            label={t("common.disabled")}
            value={counts.disabled}
            active={state.statusFilter.value === "disabled"}
            onClick={() => (state.statusFilter.value = "disabled")}
          />
          <StatCard
            icon={Zap}
            label={t("cron.stats.nextWake")}
            value={
              state.cronStatus.value?.nextWakeAtMs
                ? formatTimestamp(state.cronStatus.value.nextWakeAtMs, { relative: true })
                : "—"
            }
          />
        </div>
      )}

      {/* Error */}
      {state.error.value && (
        <div
          class="p-4 rounded-xl bg-[var(--color-error)]/10 text-[var(--color-error)]"
          role="alert"
        >
          {state.error.value}
        </div>
      )}

      {/* Loading / Connecting */}
      {(state.isLoading.value || !isConnected.value) && (
        <div class="flex justify-center py-16">
          <Spinner size="lg" label={!isConnected.value ? t("status.connecting") : undefined} />
        </div>
      )}

      {/* Jobs - Cards on mobile, Table on desktop */}
      {isConnected.value && !state.isLoading.value && computed.filteredJobs.value.length > 0 && (
        <>
          {/* Mobile: Card list (tap to edit) */}
          <div class="md:hidden space-y-2">
            {computed.filteredJobs.value.map((job) => (
              <CronJobCard
                key={job.id}
                job={job}
                onEdit={actions.openJobModal.bind(null, "edit")}
              />
            ))}
          </div>

          {/* Desktop: Table */}
          <Card padding="none" class="hidden md:block">
            <table class="w-full">
              <thead>
                <tr class="border-b border-[var(--color-border)] text-left text-sm text-[var(--color-text-muted)]">
                  <th class="py-3 px-4 font-medium">{t("cron.columns.job")}</th>
                  <th class="py-3 px-4 font-medium w-40">{t("common.schedule")}</th>
                  <th class="py-3 px-4 font-medium w-24">{t("cron.columns.target")}</th>
                  <th class="py-3 px-4 font-medium w-32">{t("common.nextRun")}</th>
                  <th class="py-3 px-4 font-medium w-24">{t("cron.columns.status")}</th>
                  <th class="py-3 px-4 font-medium w-20"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[var(--color-border)]">
                {computed.filteredJobs.value.map((job) => (
                  <CronJobRow
                    key={job.id}
                    job={job}
                    onEdit={actions.openJobModal.bind(null, "edit")}
                    onRun={actions.runJobNow}
                    onToggleEnabled={actions.toggleJobEnabled}
                    isRunning={modal.isRunning.value}
                  />
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {/* Empty state */}
      {isConnected.value &&
        !state.isLoading.value &&
        state.cronJobs.value.length === 0 &&
        !state.error.value && (
          <Card>
            <div class="p-16 text-center">
              <Clock class="w-12 h-12 mx-auto mb-4 text-[var(--color-text-muted)] opacity-50" />
              <h3 class="text-lg font-medium mb-2">{t("cron.emptyTitle")}</h3>
              <p class="text-[var(--color-text-muted)] mb-4">{t("cron.emptyDescription")}</p>
              <Button
                icon={<Plus class="w-4 h-4" />}
                onClick={() => actions.openJobModal("create")}
              >
                {t("cron.createJob")}
              </Button>
            </div>
          </Card>
        )}

      {/* No results from filter */}
      {isConnected.value &&
        !state.isLoading.value &&
        state.cronJobs.value.length > 0 &&
        computed.filteredJobs.value.length === 0 && (
          <Card>
            <div class="p-12 text-center">
              <Search class="w-10 h-10 mx-auto mb-4 text-[var(--color-text-muted)] opacity-50" />
              <h3 class="text-lg font-medium mb-2">{t("cron.noResults")}</h3>
              <p class="text-[var(--color-text-muted)] mb-4">{t("common.noResultsHint")}</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  state.searchQuery.value = "";
                  state.statusFilter.value = "all";
                }}
              >
                {t("common.clearFilters")}
              </Button>
            </div>
          </Card>
        )}

      {/* Footer count */}
      {isConnected.value && !state.isLoading.value && computed.filteredJobs.value.length > 0 && (
        <p class="text-sm text-[var(--color-text-muted)] text-center">
          {computed.filteredJobs.value.length === state.cronJobs.value.length
            ? t("cron.count", { count: state.cronJobs.value.length })
            : t("cron.filteredCount", {
                filtered: computed.filteredJobs.value.length,
                total: state.cronJobs.value.length,
              })}
        </p>
      )}

      {/* Modal */}
      <CronJobModal
        mode={modal.modalMode.value}
        job={modal.selectedJob.value}
        runs={modal.selectedJobRuns.value}
        isLoadingRuns={modal.isLoadingRuns.value}
        isDeleting={modal.isDeleting.value}
        isSaving={modal.isSaving.value}
        isRunning={modal.isRunning.value}
        hasChanges={computed.hasFormChanges.value}
        onClose={actions.closeModal}
        onSave={actions.saveOrCreateJob}
        onDelete={actions.deleteJob}
        onRun={actions.runJobNow}
        onSetDeleting={(v) => (modal.isDeleting.value = v)}
        editName={form.editName}
        editDescription={form.editDescription}
        editEnabled={form.editEnabled}
        editScheduleKind={form.editScheduleKind}
        editScheduleExpr={form.editScheduleExpr}
        editScheduleTz={form.editScheduleTz}
        editScheduleEveryMs={form.editScheduleEveryMs}
        editScheduleAtMs={form.editScheduleAtMs}
        editSessionTarget={form.editSessionTarget}
        editWakeMode={form.editWakeMode}
        editDeliveryAnnounce={form.editDeliveryAnnounce}
        editPayloadText={form.editPayloadText}
        editPayloadMessage={form.editPayloadMessage}
        editPayloadModel={form.editPayloadModel}
        formErrors={form.formErrors}
      />
    </PageLayout>
  );
}
