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
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";
import { Spinner } from "@/components/ui/Spinner";
import { LogLine, parseLogLine, resetLineIdCounter } from "@/components/logs";
import type { ParsedLogLine, LogLevel } from "@/components/logs";
import { RefreshCw, Search, Trash2, Download, FileText } from "lucide-preact";
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
  debug: "logs.debug",
  info: "logs.info",
  warn: "logs.warnings",
  error: "logs.errors",
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
// Main Component
// ============================================

export function LogsView(_props: RouteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);

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

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (shouldAutoScroll.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [filteredLines.value.length]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    shouldAutoScroll.current = scrollHeight - scrollTop - clientHeight < 50;
  };

  const lines = filteredLines.value;
  const counts = levelCounts.value;

  return (
    <div class="flex-1 overflow-y-auto p-6">
      <div class="max-w-6xl mx-auto space-y-6">
        <PageHeader
          title={t("logs.title")}
          subtitle={t("logs.description")}
          actions={
            <>
              <div class="relative">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                <Input
                  type="text"
                  value={searchQuery.value}
                  onInput={(e) => (searchQuery.value = (e.target as HTMLInputElement).value)}
                  placeholder={t("logs.searchPlaceholder")}
                  aria-label={t("logs.searchPlaceholder")}
                  class="pl-10 w-48"
                />
              </div>
              <Toggle
                checked={isLive.value}
                onChange={(checked) => (isLive.value = checked)}
                label={isLive.value ? t("logs.live") : t("logs.paused")}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchLogs(true)}
                disabled={isLoading.value}
                icon={<RefreshCw size={14} class={isLoading.value ? "animate-spin" : ""} />}
              >
                {t("actions.refresh")}
              </Button>
            </>
          }
        />

        {/* Stats bar */}
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div
            class="flex items-center gap-2"
            role="group"
            aria-label={t("logs.filterByLevel", { level: "" })}
          >
            <button
              type="button"
              onClick={clearLevelFilters}
              aria-pressed={selectedLevels.value.size === 0}
              class={`px-3 py-1 text-sm rounded-full transition-colors ${
                selectedLevels.value.size === 0
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
              }`}
            >
              {t("logs.all")} ({logLines.value.length})
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
              <span class="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                <FileText size={12} />
                {logFile.value.split("/").pop()}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={downloadLogs} icon={<Download size={14} />}>
              {t("logs.download")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearLogs}
              disabled={logLines.value.length === 0}
              icon={<Trash2 size={14} />}
            >
              {t("logs.clear")}
            </Button>
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
        <div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] overflow-hidden min-h-[calc(100vh-280px)]">
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
            <div
              ref={containerRef}
              class="max-h-[calc(100vh-280px)] overflow-y-auto"
              onScroll={handleScroll}
              role="log"
              aria-live="polite"
            >
              {lines.map((line) => (
                <LogLine
                  key={line.id}
                  line={line}
                  expanded={expandedLogs.value.has(line.id)}
                  onToggle={() => toggleExpanded(line.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
