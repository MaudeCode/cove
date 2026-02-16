/**
 * LogsView
 *
 * Gateway log viewer with live tailing, search, and filtering.
 * Route: /logs
 */

import { useEffect, useRef } from "preact/hooks";
import { t } from "@/lib/i18n";
import { toggleSetValue } from "@/hooks/useQueryParam";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";
import { Spinner } from "@/components/ui/Spinner";
import { LogLine } from "@/components/logs";
import { RefreshCw, Search, Trash2, Download, FileText } from "lucide-preact";
import { ViewErrorBoundary } from "@/components/ui/ViewErrorBoundary";
import { LevelFilter, MobileLogCard, MobileLogModal } from "@/views/logs/LogsPieces";
import {
  logLines,
  logFile,
  isLoading,
  error,
  isLive,
  searchQuery,
  selectedLevels,
  expandedLogs,
  mobileModalLogId,
  filteredLines,
  levelCounts,
  fetchLogs,
  clearLogs,
  downloadLogs,
  toggleLevel,
  clearLevelFilters,
  openMobileLogDetails,
  closeMobileLogDetails,
  useLogsQuerySync,
  useLogsViewportTracking,
  useLogsInitialFetch,
  useLogsLivePolling,
} from "@/views/logs/useLogsViewState";
import type { RouteProps } from "@/types/routes";

export function LogsView(_props: RouteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mobileContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);
  const mobileShouldAutoScroll = useRef(true);

  useLogsQuerySync();
  useLogsViewportTracking();
  useLogsInitialFetch();
  useLogsLivePolling();

  useEffect(() => {
    if (shouldAutoScroll.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
    if (mobileShouldAutoScroll.current && mobileContainerRef.current) {
      mobileContainerRef.current.scrollTop = mobileContainerRef.current.scrollHeight;
    }
  }, [filteredLines.value.length]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    shouldAutoScroll.current = scrollHeight - scrollTop - clientHeight < 50;
  };

  const handleMobileScroll = () => {
    if (!mobileContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = mobileContainerRef.current;
    mobileShouldAutoScroll.current = scrollHeight - scrollTop - clientHeight < 50;
  };

  const lines = filteredLines.value;
  const counts = levelCounts.value;

  return (
    <ViewErrorBoundary viewName={t("common.logs")}>
      <div class="flex-1 flex flex-col overflow-hidden p-4 sm:p-6">
        <div class="max-w-5xl mx-auto w-full flex flex-col flex-1 min-h-0 space-y-4 sm:space-y-6">
          <PageHeader
            title={t("common.logs")}
            subtitle={t("logs.description")}
            actions={
              <div class="flex items-center gap-2">
                <Toggle
                  checked={isLive.value}
                  onChange={(checked) => (isLive.value = checked)}
                  label={isLive.value ? t("logs.live") : t("common.paused")}
                />
                <IconButton
                  icon={<RefreshCw size={16} class={isLoading.value ? "animate-spin" : ""} />}
                  onClick={() => {
                    void fetchLogs(true);
                  }}
                  disabled={isLoading.value}
                  label={t("actions.refresh")}
                />
              </div>
            }
          />

          <Input
            type="text"
            value={searchQuery.value}
            onInput={(e) => (searchQuery.value = (e.target as HTMLInputElement).value)}
            placeholder={t("logs.searchPlaceholder")}
            aria-label={t("logs.searchPlaceholder")}
            leftElement={<Search class="w-4 h-4" />}
          />

          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div
              class="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0"
              role="group"
              aria-label={t("logs.filterByLevel", { level: "" })}
            >
              <button
                type="button"
                onClick={clearLevelFilters}
                aria-pressed={selectedLevels.value.size === 0}
                class={`px-3 py-1 text-sm rounded-full transition-colors whitespace-nowrap ${
                  selectedLevels.value.size === 0
                    ? "bg-[var(--color-accent)] text-white"
                    : "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
                }`}
              >
                {t("common.all")} ({logLines.value.length})
              </button>
              <LevelFilter
                level="debug"
                count={counts.debug}
                selected={selectedLevels.value.has("debug")}
                onClick={() => toggleLevel("debug")}
              />
              <LevelFilter
                level="info"
                count={counts.info}
                selected={selectedLevels.value.has("info")}
                onClick={() => toggleLevel("info")}
              />
              <LevelFilter
                level="warn"
                count={counts.warn}
                selected={selectedLevels.value.has("warn")}
                onClick={() => toggleLevel("warn")}
              />
              <LevelFilter
                level="error"
                count={counts.error}
                selected={selectedLevels.value.has("error")}
                onClick={() => toggleLevel("error")}
              />
            </div>

            <div class="flex items-center gap-2">
              {logFile.value && (
                <span class="hidden sm:flex text-xs text-[var(--color-text-muted)] items-center gap-1">
                  <FileText size={12} />
                  {logFile.value.split("/").pop()}
                </span>
              )}
              <div class="hidden sm:flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={downloadLogs}
                  icon={<Download size={14} />}
                >
                  {t("common.download")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearLogs}
                  disabled={logLines.value.length === 0}
                  icon={<Trash2 size={14} />}
                >
                  {t("common.clear")}
                </Button>
              </div>
              <div class="flex sm:hidden items-center gap-1">
                <IconButton
                  icon={<Download size={16} />}
                  onClick={downloadLogs}
                  label={t("common.download")}
                  size="sm"
                />
                <IconButton
                  icon={<Trash2 size={16} />}
                  onClick={clearLogs}
                  disabled={logLines.value.length === 0}
                  label={t("common.clear")}
                  size="sm"
                />
              </div>
            </div>
          </div>

          {error.value && (
            <div
              class="p-4 rounded-lg bg-[var(--color-error)]/10 text-[var(--color-error)] text-sm"
              role="alert"
            >
              {error.value}
            </div>
          )}

          <div class="flex-1 min-h-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] overflow-hidden flex flex-col">
            {isLoading.value && logLines.value.length === 0 && (
              <div class="flex items-center justify-center py-12">
                <Spinner size="lg" />
              </div>
            )}

            {!isLoading.value && logLines.value.length === 0 && (
              <div class="text-center py-12 text-[var(--color-text-muted)]">
                <FileText size={32} class="mx-auto mb-2 opacity-50" />
                <p>{t("logs.noLogs")}</p>
                <p class="text-sm mt-1">{t("logs.noLogsHint")}</p>
              </div>
            )}

            {logLines.value.length > 0 && lines.length === 0 && (
              <div class="text-center py-12 text-[var(--color-text-muted)]">
                <Search size={32} class="mx-auto mb-2 opacity-50" />
                <p>{t("logs.noMatches")}</p>
              </div>
            )}

            {lines.length > 0 && (
              <>
                <div
                  ref={mobileContainerRef}
                  class="md:hidden flex-1 overflow-y-auto p-3 space-y-2"
                  onScroll={handleMobileScroll}
                  role="log"
                  aria-live="polite"
                >
                  {lines.map((line) => (
                    <div key={line.id} data-log-id={line.id}>
                      <MobileLogCard line={line} onSelect={openMobileLogDetails} />
                    </div>
                  ))}
                </div>

                <div
                  ref={containerRef}
                  class="hidden md:flex md:flex-col flex-1 overflow-y-auto"
                  onScroll={handleScroll}
                  role="log"
                  aria-live="polite"
                >
                  {lines.map((line) => (
                    <div key={line.id} data-log-id={line.id}>
                      <LogLine
                        line={line}
                        expanded={expandedLogs.value.has(line.id)}
                        onToggle={() => {
                          toggleSetValue(expandedLogs, line.id, { pushHistory: true });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <MobileLogModal
            logId={mobileModalLogId.value}
            lines={logLines.value}
            onClose={closeMobileLogDetails}
          />
        </div>
      </div>
    </ViewErrorBoundary>
  );
}
