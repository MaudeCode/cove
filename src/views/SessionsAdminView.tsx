/**
 * SessionsAdminView
 *
 * Session management with search, filtering, and detail editing.
 * Route: /sessions
 */

import { t } from "@/lib/i18n";
import { isConnected } from "@/lib/gateway";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { IconButton } from "@/components/ui/IconButton";
import { StatCard } from "@/components/ui/StatCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { RefreshCw, Search, MessageSquare } from "lucide-preact";
import { PageLayout } from "@/components/ui/PageLayout";
import { SessionsAdminList } from "@/views/sessions-admin/SessionsAdminList";
import { SessionDetailModal } from "@/views/sessions-admin/SessionDetailModal";
import {
  adminSessions,
  filteredSessions,
  sessionCounts,
  isLoading,
  error,
  searchQuery,
  kindFilter,
  loadAdminSessions,
  getKindStyle,
  useSessionsAdminQuerySync,
  useSessionsAdminInitialLoad,
} from "@/views/sessions-admin/useSessionsAdminState";
import type { RouteProps } from "@/types/routes";

export function SessionsAdminView(_props: RouteProps) {
  useSessionsAdminQuerySync();
  useSessionsAdminInitialLoad();

  const counts = sessionCounts.value;

  return (
    <PageLayout viewName={t("common.sessions")}>
      <PageHeader
        title={t("common.sessions")}
        subtitle={t("sessions.admin.description")}
        actions={
          <>
            {isConnected.value && !isLoading.value && adminSessions.value.length > 0 && (
              <div class="relative hidden sm:block">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                <Input
                  type="text"
                  value={searchQuery.value}
                  onInput={(e) => (searchQuery.value = (e.target as HTMLInputElement).value)}
                  placeholder={t("sessions.admin.searchPlaceholder")}
                  class="pl-10 w-48 lg:w-64"
                />
              </div>
            )}
            <IconButton
              icon={<RefreshCw class={`w-4 h-4 ${isLoading.value ? "animate-spin" : ""}`} />}
              label={t("actions.refresh")}
              onClick={() => {
                void loadAdminSessions();
              }}
              disabled={isLoading.value || !isConnected.value}
              variant="ghost"
            />
          </>
        }
      />

      {isConnected.value && !isLoading.value && adminSessions.value.length > 0 && (
        <div class="relative md:hidden">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <Input
            type="text"
            value={searchQuery.value}
            onInput={(e) => (searchQuery.value = (e.target as HTMLInputElement).value)}
            placeholder={t("sessions.admin.searchPlaceholder")}
            class="pl-10"
            fullWidth
          />
        </div>
      )}

      {isConnected.value && !isLoading.value && (
        <div class="flex flex-wrap justify-center sm:grid sm:grid-cols-5 gap-2 sm:gap-3 [&>*]:w-[calc(33.333%-0.375rem)] sm:[&>*]:w-auto">
          <StatCard
            icon={MessageSquare}
            label={t("common.total")}
            value={counts.total}
            active={kindFilter.value === "all"}
            onClick={() => (kindFilter.value = "all")}
          />
          <StatCard
            icon={getKindStyle("main").icon}
            label={t("common.main")}
            value={counts.main}
            active={kindFilter.value === "main"}
            onClick={() => (kindFilter.value = "main")}
          />
          <StatCard
            icon={getKindStyle("channel").icon}
            label={t("common.channel")}
            value={counts.channel}
            active={kindFilter.value === "channel"}
            onClick={() => (kindFilter.value = "channel")}
          />
          <StatCard
            icon={getKindStyle("cron").icon}
            label={t("sessions.admin.kinds.cron")}
            value={counts.cron}
            active={kindFilter.value === "cron"}
            onClick={() => (kindFilter.value = "cron")}
          />
          <StatCard
            icon={getKindStyle("isolated").icon}
            label={t("common.isolated")}
            value={counts.isolated}
            active={kindFilter.value === "isolated"}
            onClick={() => (kindFilter.value = "isolated")}
          />
        </div>
      )}

      {error.value && (
        <div class="p-4 rounded-xl bg-[var(--color-error)]/10 text-[var(--color-error)]">
          {error.value}
        </div>
      )}

      {(isLoading.value || !isConnected.value) && (
        <div class="flex justify-center py-16">
          <Spinner size="lg" label={!isConnected.value ? t("status.connecting") : undefined} />
        </div>
      )}

      {isConnected.value && !isLoading.value && filteredSessions.value.length > 0 && (
        <SessionsAdminList />
      )}

      {isConnected.value &&
        !isLoading.value &&
        adminSessions.value.length === 0 &&
        !error.value && (
          <Card>
            <div class="p-16 text-center">
              <MessageSquare class="w-12 h-12 mx-auto mb-4 text-[var(--color-text-muted)] opacity-50" />
              <h3 class="text-lg font-medium mb-2">{t("sessions.admin.emptyTitle")}</h3>
              <p class="text-[var(--color-text-muted)]">{t("sessions.admin.emptyDescription")}</p>
            </div>
          </Card>
        )}

      {isConnected.value &&
        !isLoading.value &&
        adminSessions.value.length > 0 &&
        filteredSessions.value.length === 0 && (
          <Card>
            <div class="p-12 text-center">
              <Search class="w-10 h-10 mx-auto mb-4 text-[var(--color-text-muted)] opacity-50" />
              <h3 class="text-lg font-medium mb-2">{t("sessions.admin.noResults")}</h3>
              <p class="text-[var(--color-text-muted)] mb-4">{t("common.noResultsHint")}</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  searchQuery.value = "";
                  kindFilter.value = "all";
                }}
              >
                {t("common.clearFilters")}
              </Button>
            </div>
          </Card>
        )}

      {isConnected.value && !isLoading.value && filteredSessions.value.length > 0 && (
        <p class="text-sm text-[var(--color-text-muted)] text-center">
          {filteredSessions.value.length === adminSessions.value.length
            ? t("sessions.admin.count", { count: adminSessions.value.length })
            : t("sessions.admin.filteredCount", {
                filtered: filteredSessions.value.length,
                total: adminSessions.value.length,
              })}
        </p>
      )}

      <SessionDetailModal />
    </PageLayout>
  );
}
