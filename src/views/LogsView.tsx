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
import {
  RefreshCw,
  Search,
  Trash2,
  Download,
  FileText,
  AlertCircle,
  Info,
  AlertTriangle,
  Bug,
  ChevronRight,
} from "lucide-preact";
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

interface ParsedLogLine {
  id: number;
  raw: string;
  timestamp?: string;
  level?: "debug" | "info" | "warn" | "error";
  message: string;
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
const selectedLevels = signal<Set<"debug" | "info" | "warn" | "error">>(new Set());
const expandedLogs = signal<Set<number>>(new Set());

let lineIdCounter = 0;

// ============================================
// Helpers
// ============================================

function parseLogLine(raw: string): ParsedLogLine {
  const id = ++lineIdCounter;

  let timestamp: string | undefined;
  let level: ParsedLogLine["level"];
  let message = raw;

  // Try JSON format first: {"level":"info","time":"...","msg":"..."}
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw);
      timestamp = parsed.time || parsed.timestamp || parsed.ts;
      const jsonLevel = (parsed.level || parsed.lvl || "")?.toLowerCase();
      if (["debug", "info", "warn", "warning", "error", "err"].includes(jsonLevel)) {
        level =
          jsonLevel === "warning"
            ? "warn"
            : jsonLevel === "err"
              ? "error"
              : (jsonLevel as ParsedLogLine["level"]);
      }

      // Try to get a meaningful message
      if (parsed.msg || parsed.message) {
        message = parsed.msg || parsed.message;
      } else if (parsed.error && typeof parsed.error === "string") {
        message = parsed.error;
      } else {
        // Format key fields into a readable message
        const skipKeys = ["time", "timestamp", "ts", "level", "lvl", "pid", "hostname", "v"];
        const parts: string[] = [];
        for (const [key, value] of Object.entries(parsed)) {
          if (skipKeys.includes(key) || /^\d+$/.test(key)) continue;
          if (typeof value === "string") {
            parts.push(`${key}=${value}`);
          } else if (value !== null && value !== undefined) {
            parts.push(`${key}=${JSON.stringify(value)}`);
          }
        }
        message = parts.length > 0 ? parts.join("  ") : raw;
      }
    } catch {
      // Not valid JSON, continue with text parsing
    }
  }

  // Try OpenClaw text format: 2024-01-01T12:00:00.000Z [category] message
  if (!timestamp) {
    const openclawMatch = raw.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s+\[([^\]]+)\]\s*(.*)$/);
    if (openclawMatch) {
      timestamp = openclawMatch[1];
      message = `[${openclawMatch[2]}] ${openclawMatch[3]}`;

      // Infer level from message content or category
      const fullText = raw.toLowerCase();
      if (fullText.includes("error") || fullText.includes("err ") || fullText.includes("✗")) {
        level = "error";
      } else if (fullText.includes("warn") || fullText.includes("warning")) {
        level = "warn";
      } else if (fullText.includes("debug")) {
        level = "debug";
      } else {
        level = "info";
      }
    }
  }

  // Try bracketed format: [2024-01-01T12:00:00.000Z] INFO: message
  if (!timestamp) {
    const bracketMatch = raw.match(/^\[([^\]]+)\]\s*(DEBUG|INFO|WARN|ERROR):?\s*(.*)$/i);
    if (bracketMatch) {
      timestamp = bracketMatch[1];
      level = bracketMatch[2].toLowerCase() as ParsedLogLine["level"];
      message = bracketMatch[3];
    }
  }

  // Try cloudflared format: 2024-01-01T12:00:00Z ERR message
  if (!timestamp) {
    const cfMatch = raw.match(/^(\d{4}-\d{2}-\d{2}T[\d:]+Z)\s+(ERR|INF|WRN|DBG)\s+(.*)$/);
    if (cfMatch) {
      timestamp = cfMatch[1];
      const cfLevel = cfMatch[2];
      level =
        cfLevel === "ERR"
          ? "error"
          : cfLevel === "WRN"
            ? "warn"
            : cfLevel === "DBG"
              ? "debug"
              : "info";
      message = cfMatch[3];
    }
  }

  // Try simple format: INFO message or INFO: message
  if (!level && !timestamp) {
    const simpleMatch = raw.match(/^(DEBUG|INFO|WARN|ERROR):?\s+(.*)$/i);
    if (simpleMatch) {
      level = simpleMatch[1].toLowerCase() as ParsedLogLine["level"];
      message = simpleMatch[2];
    }
  }

  // Fallback: infer level from content if still not set
  if (!level) {
    const lowerRaw = raw.toLowerCase();
    if (
      lowerRaw.includes("error") ||
      lowerRaw.includes("failed") ||
      lowerRaw.includes("exception") ||
      lowerRaw.includes("✗")
    ) {
      level = "error";
    } else if (lowerRaw.includes("warn") || lowerRaw.includes("deprecated")) {
      level = "warn";
    } else if (lowerRaw.includes("debug") || lowerRaw.includes("trace")) {
      level = "debug";
    }
  }

  return { id, raw, timestamp, level, message };
}

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
        logLines.value = response.lines.map(parseLogLine);
      } else {
        // Append new lines
        const newLines = response.lines.map(parseLogLine);
        if (newLines.length > 0) {
          logLines.value = [...logLines.value, ...newLines].slice(-2000); // Keep last 2000 lines
        }
      }
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to fetch logs";
  } finally {
    isLoading.value = false;
  }
}

function clearLogs() {
  logLines.value = [];
  cursor.value = 0;
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

// ============================================
// Computed
// ============================================

const filteredLines = computed(() => {
  let lines = logLines.value;

  // Filter by level (if any selected)
  const levels = selectedLevels.value;
  if (levels.size > 0) {
    lines = lines.filter((l) => l.level && levels.has(l.level));
  }

  // Filter by search
  const query = searchQuery.value.toLowerCase().trim();
  if (query) {
    lines = lines.filter((l) => l.raw.toLowerCase().includes(query));
  }

  return lines;
});

function toggleLevel(level: "debug" | "info" | "warn" | "error") {
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
// Log Line Component
// ============================================

/** Flatten nested objects into dot-notation keys (arrays are stringified, not indexed) */
function flattenObject(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip numeric keys (array indices)
    if (/^\d+$/.test(key)) continue;

    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      // Stringify arrays instead of flattening with indices
      result[fullKey] = JSON.stringify(value);
    } else if (typeof value === "object") {
      Object.assign(result, flattenObject(value as Record<string, unknown>, fullKey));
    } else if (typeof value === "string") {
      result[fullKey] = value;
    } else {
      result[fullKey] = JSON.stringify(value);
    }
  }
  return result;
}

function LogLine({
  line,
  expanded,
  onToggle,
}: {
  line: ParsedLogLine;
  expanded: boolean;
  onToggle: () => void;
}) {
  const levelColors: Record<string, string> = {
    debug: "text-[var(--color-text-muted)]",
    info: "text-[var(--color-info)]",
    warn: "text-[var(--color-warning)]",
    error: "text-[var(--color-error)]",
  };

  const levelIcons: Record<string, typeof Info> = {
    debug: Bug,
    info: Info,
    warn: AlertTriangle,
    error: AlertCircle,
  };

  const Icon = line.level ? levelIcons[line.level] : undefined;
  const iconColor = line.level ? levelColors[line.level] : "text-[var(--color-text-muted)]";

  // Format timestamp for display
  const displayTime = line.timestamp
    ? line.timestamp.split("T")[1]?.slice(0, 12) || line.timestamp.slice(0, 12)
    : null;

  // Parse fields from JSON
  let fields: Record<string, string> | null = null;
  let mainMessage = line.message;

  if (line.raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(line.raw);
      mainMessage = parsed.msg || parsed.message || "";
      const skipKeys = [
        "time",
        "timestamp",
        "ts",
        "level",
        "lvl",
        "pid",
        "hostname",
        "v",
        "msg",
        "message",
      ];
      const filtered: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (!skipKeys.includes(key)) filtered[key] = value;
      }
      if (Object.keys(filtered).length > 0) {
        fields = flattenObject(filtered);
      }
    } catch {
      // Not JSON
    }
  }

  const hasFields = fields && Object.keys(fields).length > 0;

  return (
    <div class="border-b border-[var(--color-border)]/50 last:border-0">
      <button
        type="button"
        onClick={onToggle}
        disabled={!hasFields}
        class="w-full text-left py-2 px-3 hover:bg-[var(--color-bg-hover)] flex items-start gap-2 font-mono text-xs disabled:cursor-default"
      >
        {hasFields ? (
          <ChevronRight
            size={12}
            class={`mt-0.5 flex-shrink-0 text-[var(--color-text-muted)] transition-transform ${expanded ? "rotate-90" : ""}`}
          />
        ) : (
          <span class="w-3 flex-shrink-0" />
        )}
        {Icon && <Icon size={14} class={`mt-0.5 flex-shrink-0 ${iconColor}`} />}
        {displayTime && (
          <span class="text-[var(--color-text-muted)] flex-shrink-0">{displayTime}</span>
        )}
        <span class="flex-1 text-[var(--color-text-primary)] truncate">
          {mainMessage || line.message}
        </span>
      </button>

      {expanded && hasFields && (
        <div class="pb-3 px-3 ml-7 space-y-1">
          {Object.entries(fields!).map(([key, value]) => (
            <div key={key} class="flex gap-2 text-xs font-mono">
              <span class="text-[var(--color-accent)] flex-shrink-0">{key}</span>
              <span class="text-[var(--color-text-secondary)] break-all">{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
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

    const interval = setInterval(() => {
      fetchLogs();
    }, 2000);

    return () => clearInterval(interval);
  }, [isLive.value, isConnected.value]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (shouldAutoScroll.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [filteredLines.value.length]);

  // Track scroll position to disable auto-scroll when user scrolls up
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
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <button
              type="button"
              onClick={clearLevelFilters}
              class={`px-3 py-1 text-sm rounded-full transition-colors ${
                selectedLevels.value.size === 0
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
              }`}
            >
              {t("logs.all")} ({logLines.value.length})
            </button>
            <button
              type="button"
              onClick={() => toggleLevel("debug")}
              class={`px-3 py-1 text-sm rounded-full transition-colors ${
                selectedLevels.value.has("debug")
                  ? "bg-[var(--color-text-muted)]/30 text-[var(--color-text-primary)] ring-1 ring-[var(--color-text-muted)]"
                  : "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
              }`}
            >
              {t("logs.debug")} ({counts.debug})
            </button>
            <button
              type="button"
              onClick={() => toggleLevel("info")}
              class={`px-3 py-1 text-sm rounded-full transition-colors ${
                selectedLevels.value.has("info")
                  ? "bg-[var(--color-info)]/20 text-[var(--color-info)] ring-1 ring-[var(--color-info)]"
                  : "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
              }`}
            >
              {t("logs.info")} ({counts.info})
            </button>
            <button
              type="button"
              onClick={() => toggleLevel("warn")}
              class={`px-3 py-1 text-sm rounded-full transition-colors ${
                selectedLevels.value.has("warn")
                  ? "bg-[var(--color-warning)]/20 text-[var(--color-warning)] ring-1 ring-[var(--color-warning)]"
                  : "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
              }`}
            >
              {t("logs.warnings")} ({counts.warn})
            </button>
            <button
              type="button"
              onClick={() => toggleLevel("error")}
              class={`px-3 py-1 text-sm rounded-full transition-colors ${
                selectedLevels.value.has("error")
                  ? "bg-[var(--color-error)]/20 text-[var(--color-error)] ring-1 ring-[var(--color-error)]"
                  : "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
              }`}
            >
              {t("logs.errors")} ({counts.error})
            </button>
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
          <div class="p-4 rounded-lg bg-[var(--color-error)]/10 text-[var(--color-error)] text-sm">
            {error.value}
          </div>
        )}

        {/* Log viewer */}
        <div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] overflow-hidden">
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
              class="max-h-[calc(100vh-320px)] overflow-y-auto"
              onScroll={handleScroll}
            >
              {lines.map((line) => (
                <LogLine
                  key={line.id}
                  line={line}
                  expanded={expandedLogs.value.has(line.id)}
                  onToggle={() => {
                    const current = new Set(expandedLogs.value);
                    if (current.has(line.id)) {
                      current.delete(line.id);
                    } else {
                      current.add(line.id);
                    }
                    expandedLogs.value = current;
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
