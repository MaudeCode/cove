/**
 * LogsView
 *
 * Gateway log viewer with live tailing, search, and filtering.
 * Route: /logs
 */

import { signal, computed } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { t } from "@/lib/i18n";
import { send, isConnected } from "@/lib/gateway";
import {
  useQueryParam,
  useQueryParamSet,
  useSyncToParam,
  useInitFromParam,
  pushQueryState,
} from "@/hooks/useQueryParam";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import {
  LogLine,
  parseLogLine,
  resetLineIdCounter,
  levelIcons,
  levelColors,
  formatLogTimestamp,
  formatRawLog,
} from "@/components/logs";
import type { ParsedLogLine, LogLevel } from "@/components/logs";
import { RefreshCw, Search, Trash2, Download, FileText, ChevronRight, Info } from "lucide-preact";
import { ViewErrorBoundary } from "@/components/ui/ViewErrorBoundary";
import type { RouteProps } from "@/types/routes";

// ============================================
// Types
// ============================================

interface LogsResponse {
  file: string;
  cursor: number;
  size: number;
  lines: string[];
  truncated: boolean;
  reset: boolean;
}

// ============================================
// State
// ============================================

const logLines = signal<ParsedLogLine[]>([]);
const cursor = signal<number>(0);
const logFile = signal<string>("");
const isLoading = signal(false);
const error = signal<string | null>(null);
const isLive = signal(true);
const searchQuery = signal("");
const selectedLevels = signal<Set<LogLevel>>(new Set());
const expandedLogs = signal<Set<number>>(new Set());

/** Mobile log detail modal - derived from expandedLogs for URL sync */
const mobileModalLogId = signal<number | null>(null);

// ============================================
// Actions
// ============================================

async function fetchLogs(reset = false) {
  if (!isConnected.value) return;

  isLoading.value = true;
  error.value = null;

  try {
    const response = await send<LogsResponse>("logs.tail", {
      cursor: reset ? undefined : cursor.value || undefined,
      limit: 500,
      maxBytes: 250000,
    });

    if (response) {
      logFile.value = response.file;
      cursor.value = response.cursor;

      if (response.reset || reset) {
        // File was rotated or manual reset - replace all lines
        resetLineIdCounter();
        logLines.value = response.lines.map(parseLogLine);
      } else {
        // Append new lines
        const newLines = response.lines.map(parseLogLine);
        if (newLines.length > 0) {
          logLines.value = [...logLines.value, ...newLines].slice(-2000);
        }
      }
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : t("logs.fetchError");
  } finally {
    isLoading.value = false;
  }
}

function clearLogs() {
  logLines.value = [];
  cursor.value = 0;
  resetLineIdCounter();
}

function downloadLogs() {
  const content = logLines.value.map((l) => l.raw).join("\n");
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `openclaw-logs-${new Date().toISOString().slice(0, 10)}.log`;
  a.click();
  URL.revokeObjectURL(url);
}

function toggleLevel(level: LogLevel) {
  const current = new Set(selectedLevels.value);
  if (current.has(level)) {
    current.delete(level);
  } else {
    current.add(level);
  }
  selectedLevels.value = current;
}

function clearLevelFilters() {
  selectedLevels.value = new Set();
}

function toggleExpanded(id: number) {
  const current = new Set(expandedLogs.value);
  if (current.has(id)) {
    current.delete(id);
  } else {
    current.add(id);
  }
  expandedLogs.value = current;
}

// ============================================
// Computed
// ============================================

const filteredLines = computed(() => {
  let lines = logLines.value;

  const levels = selectedLevels.value;
  if (levels.size > 0) {
    lines = lines.filter((l) => l.level && levels.has(l.level));
  }

  const query = searchQuery.value.toLowerCase().trim();
  if (query) {
    lines = lines.filter((l) => l.raw.toLowerCase().includes(query));
  }

  return lines;
});

const levelCounts = computed(() => {
  const counts = { debug: 0, info: 0, warn: 0, error: 0 };
  for (const line of logLines.value) {
    if (line.level && line.level in counts) {
      counts[line.level]++;
    }
  }
  return counts;
});

// ============================================
// Level Filter Button
// ============================================

interface LevelFilterProps {
  level: LogLevel;
  count: number;
  selected: boolean;
  onClick: () => void;
}

const levelStyles: Record<LogLevel, { active: string; inactive: string }> = {
  debug: {
    active:
      "bg-[var(--color-text-muted)]/30 text-[var(--color-text-primary)] ring-1 ring-[var(--color-text-muted)]",
    inactive:
      "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]",
  },
  info: {
    active: "bg-[var(--color-info)]/20 text-[var(--color-info)] ring-1 ring-[var(--color-info)]",
    inactive:
      "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]",
  },
  warn: {
    active:
      "bg-[var(--color-warning)]/20 text-[var(--color-warning)] ring-1 ring-[var(--color-warning)]",
    inactive:
      "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]",
  },
  error: {
    active: "bg-[var(--color-error)]/20 text-[var(--color-error)] ring-1 ring-[var(--color-error)]",
    inactive:
      "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]",
  },
};

const levelLabels: Record<LogLevel, string> = {
  debug: "common.debug",
  info: "logs.info",
  warn: "logs.warnings",
  error: "common.error",
};

function LevelFilter({ level, count, selected, onClick }: LevelFilterProps) {
  const styles = levelStyles[level];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("logs.filterByLevel", { level: t(levelLabels[level]) })}
      aria-pressed={selected}
      class={`px-3 py-1 text-sm rounded-full transition-colors ${selected ? styles.active : styles.inactive}`}
    >
      {t(levelLabels[level])} ({count})
    </button>
  );
}

// ============================================
// Mobile Log Modal
// ============================================

interface MobileLogModalProps {
  logId: number | null;
  lines: ParsedLogLine[];
  onClose: () => void;
}

function MobileLogModal({ logId, lines, onClose }: MobileLogModalProps) {
  const line = logId !== null ? lines.find((l) => l.id === logId) : null;

  return (
    <Modal open={!!line} onClose={onClose} title={t("logs.logDetails")}>
      {line && (
        <div class="space-y-4">
          {/* Level & timestamp */}
          <div class="flex items-center gap-2">
            {line.level && (
              <Badge
                variant={
                  line.level === "error" ? "error" : line.level === "warn" ? "warning" : "default"
                }
              >
                {line.level}
              </Badge>
            )}
            {line.timestamp && (
              <span class="text-sm text-[var(--color-text-muted)] font-mono">{line.timestamp}</span>
            )}
          </div>

          {/* Message */}
          <div>
            <h4 class="text-xs font-medium text-[var(--color-text-muted)] mb-1">
              {t("logs.message")}
            </h4>
            <p class="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap break-words">
              {line.message}
            </p>
          </div>

          {/* Fields */}
          {line.fields && Object.keys(line.fields).length > 0 && (
            <div>
              <h4 class="text-xs font-medium text-[var(--color-text-muted)] mb-2">
                {t("logs.fields")}
              </h4>
              <div class="space-y-2 bg-[var(--color-bg-tertiary)] rounded-lg p-3">
                {Object.entries(line.fields).map(([key, value]) => (
                  <div key={key} class="text-xs font-mono">
                    <span class="text-[var(--color-accent)]">{key}</span>
                    <span class="text-[var(--color-text-muted)] mx-1">=</span>
                    <span class="text-[var(--color-text-secondary)] break-all">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw JSON */}
          <div>
            <h4 class="text-xs font-medium text-[var(--color-text-muted)] mb-1">
              {t("logs.rawLine")}
            </h4>
            <pre class="text-xs font-mono text-[var(--color-text-secondary)] bg-[var(--color-bg-tertiary)] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
              {formatRawLog(line.raw)}
            </pre>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ============================================
// Mobile Log Card
// ============================================

interface MobileLogCardProps {
  line: ParsedLogLine;
  onSelect: (id: number) => void;
}

function MobileLogCard({ line, onSelect }: MobileLogCardProps) {
  const Icon = line.level ? levelIcons[line.level] : Info;
  const iconColor = line.level ? levelColors[line.level] : "text-[var(--color-text-muted)]";
  const hasFields = line.fields && Object.keys(line.fields).length > 0;
  const displayTime = formatLogTimestamp(line.timestamp);

  return (
    <button
      type="button"
      class="w-full flex items-start gap-3 p-3 text-left bg-[var(--color-bg-secondary)] rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
      onClick={() => onSelect(line.id)}
      aria-label={t("logs.viewLogDetails")}
    >
      <Icon size={16} class={`mt-0.5 flex-shrink-0 ${iconColor}`} />
      <div class="flex-1 min-w-0">
        <p class="text-sm text-[var(--color-text-primary)] line-clamp-2">{line.message}</p>
        <div class="flex items-center gap-2 mt-1">
          {displayTime && (
            <span class="text-xs text-[var(--color-text-muted)] font-mono">{displayTime}</span>
          )}
          {hasFields && (
            <Badge variant="default" class="text-xs">
              {Object.keys(line.fields!).length} {t("logs.fields")}
            </Badge>
          )}
        </div>
      </div>
      <ChevronRight size={16} class="text-[var(--color-text-muted)] flex-shrink-0 mt-0.5" />
    </button>
  );
}

// ============================================
// Main Component
// ============================================

export function LogsView(_props: RouteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mobileContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);
  const mobileShouldAutoScroll = useRef(true);

  // URL query params as source of truth
  const logsReady = !isLoading.value && logLines.value.length > 0;
  const [searchParam, setSearchParam] = useQueryParam("q");
  const [levelParam, setLevelParam] = useQueryParamSet<LogLevel>("level");
  const [liveParam, setLiveParam] = useQueryParam("live");
  const [expandedParam, setExpandedParam, expandedInitialized] = useQueryParamSet<number>("log", {
    ready: logsReady,
    parse: (s) => parseInt(s, 10),
  });

  // Sync URL → state on mount
  useInitFromParam(searchParam, searchQuery, (s) => s);
  useEffect(() => {
    if (levelParam.value.size > 0) selectedLevels.value = levelParam.value;
    if (liveParam.value === "0") isLive.value = false;
  }, []);

  // Sync state → URL
  useSyncToParam(searchQuery, setSearchParam);

  useEffect(() => {
    setLevelParam(selectedLevels.value);
  }, [selectedLevels.value]);

  useEffect(() => {
    setLiveParam(isLive.value ? null : "0");
  }, [isLive.value]);

  // Sync URL → expanded log (desktop expands, mobile opens modal)
  useEffect(() => {
    if (logsReady && expandedParam.value.size > 0) {
      const validIds = Array.from(expandedParam.value).filter((id) =>
        logLines.value.some((l) => l.id === id),
      );
      const newIds = validIds.filter((id) => !expandedLogs.value.has(id));
      if (newIds.length > 0) {
        expandedLogs.value = new Set([...expandedLogs.value, ...validIds]);
        // On mobile, open modal for the first log in the URL param
        const isMobile = window.matchMedia("(max-width: 767px)").matches;
        if (isMobile && mobileModalLogId.value === null) {
          mobileModalLogId.value = newIds[0];
        }
        // Scroll to the first new one
        // Note: mobile and desktop both have data-log-id, pick the visible one
        setTimeout(() => {
          const els = document.querySelectorAll(`[data-log-id="${newIds[0]}"]`);
          const el = Array.from(els).find((e) => (e as HTMLElement).offsetParent !== null);
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
      }
    }
  }, [expandedParam.value, logsReady]);

  // Sync expanded → URL
  useEffect(() => {
    if (expandedInitialized.value) {
      setExpandedParam(expandedLogs.value);
    }
  }, [expandedLogs.value, expandedInitialized.value]);

  // Initial fetch
  useEffect(() => {
    if (isConnected.value) {
      fetchLogs(true);
    }
  }, [isConnected.value]);

  // Live polling
  useEffect(() => {
    if (!isLive.value || !isConnected.value) return;

    const interval = setInterval(() => fetchLogs(), 2000);
    return () => clearInterval(interval);
  }, [isLive.value, isConnected.value]);

  // Auto-scroll to bottom when new logs arrive (desktop)
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
                  onClick={() => fetchLogs(true)}
                  disabled={isLoading.value}
                  label={t("actions.refresh")}
                />
              </div>
            }
          />

          {/* Search - full width on mobile */}
          <Input
            type="text"
            value={searchQuery.value}
            onInput={(e) => (searchQuery.value = (e.target as HTMLInputElement).value)}
            placeholder={t("logs.searchPlaceholder")}
            aria-label={t("logs.searchPlaceholder")}
            leftElement={<Search class="w-4 h-4" />}
          />

          {/* Stats bar */}
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Level filters - horizontal scroll on mobile */}
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
            {/* Actions */}
            <div class="flex items-center gap-2">
              {logFile.value && (
                <span class="hidden sm:flex text-xs text-[var(--color-text-muted)] items-center gap-1">
                  <FileText size={12} />
                  {logFile.value.split("/").pop()}
                </span>
              )}
              {/* Desktop: buttons with labels */}
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
              {/* Mobile: icon-only buttons */}
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

          {/* Error */}
          {error.value && (
            <div
              class="p-4 rounded-lg bg-[var(--color-error)]/10 text-[var(--color-error)] text-sm"
              role="alert"
            >
              {error.value}
            </div>
          )}

          {/* Log viewer */}
          <div class="flex-1 min-h-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] overflow-hidden flex flex-col">
            {/* Loading state */}
            {isLoading.value && logLines.value.length === 0 && (
              <div class="flex items-center justify-center py-12">
                <Spinner size="lg" />
              </div>
            )}

            {/* Empty state */}
            {!isLoading.value && logLines.value.length === 0 && (
              <div class="text-center py-12 text-[var(--color-text-muted)]">
                <FileText size={32} class="mx-auto mb-2 opacity-50" />
                <p>{t("logs.noLogs")}</p>
                <p class="text-sm mt-1">{t("logs.noLogsHint")}</p>
              </div>
            )}

            {/* No results after filter */}
            {logLines.value.length > 0 && lines.length === 0 && (
              <div class="text-center py-12 text-[var(--color-text-muted)]">
                <Search size={32} class="mx-auto mb-2 opacity-50" />
                <p>{t("logs.noMatches")}</p>
              </div>
            )}

            {/* Log lines */}
            {lines.length > 0 && (
              <>
                {/* Mobile: Card list */}
                <div
                  ref={mobileContainerRef}
                  class="md:hidden flex-1 overflow-y-auto p-3 space-y-2"
                  onScroll={handleMobileScroll}
                  role="log"
                  aria-live="polite"
                >
                  {lines.map((line) => (
                    <div key={line.id} data-log-id={line.id}>
                      <MobileLogCard
                        line={line}
                        onSelect={(id) => {
                          mobileModalLogId.value = id;
                          // Add to expandedLogs for URL sync
                          const current = new Set(expandedLogs.value);
                          current.add(id);
                          expandedLogs.value = current;
                          pushQueryState();
                        }}
                      />
                    </div>
                  ))}
                </div>

                {/* Desktop: Expandable rows */}
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
                          toggleExpanded(line.id);
                          if (!expandedLogs.value.has(line.id)) {
                            pushQueryState(); // Push to history when expanding
                          }
                        }}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Mobile log detail modal */}
          <MobileLogModal
            logId={mobileModalLogId.value}
            lines={logLines.value}
            onClose={() => {
              // Remove from expandedLogs when closing
              if (mobileModalLogId.value !== null) {
                const current = new Set(expandedLogs.value);
                current.delete(mobileModalLogId.value);
                expandedLogs.value = current;
              }
              mobileModalLogId.value = null;
            }}
          />
        </div>
      </div>
    </ViewErrorBoundary>
  );
}
