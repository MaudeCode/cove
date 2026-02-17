import { signal, computed } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { t } from "@/lib/i18n";
import { send, isConnected } from "@/lib/gateway";
import {
  useQueryParam,
  useQueryParamSet,
  useSyncToParam,
  useInitFromParam,
  pushQueryState,
  toggleSetValue,
} from "@/hooks/useQueryParam";
import { useExpandableFromQueryParamSet } from "@/hooks/useExpandableFromQueryParamSet";
import { parseLogLine, resetLineIdCounter } from "@/components/logs";
import type { ParsedLogLine, LogLevel } from "@/components/logs";

export const logLines = signal<ParsedLogLine[]>([]);
export const cursor = signal<number>(0);
export const logFile = signal<string>("");
export const isLoading = signal(false);
export const error = signal<string | null>(null);
export const isLive = signal(true);
export const searchQuery = signal("");
export const selectedLevels = signal<Set<LogLevel>>(new Set());
export const expandedLogs = signal<Set<number>>(new Set());
export const isMobileViewport = signal(
  typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false,
);

export const mobileModalLogId = computed<number | null>(() => {
  if (!isMobileViewport.value || expandedLogs.value.size === 0) return null;
  const expanded = Array.from(expandedLogs.value);
  return expanded[expanded.length - 1] ?? null;
});

export async function fetchLogs(reset = false): Promise<void> {
  if (!isConnected.value) return;

  isLoading.value = true;
  error.value = null;

  try {
    const response = await send("logs.tail", {
      cursor: reset ? undefined : cursor.value || undefined,
      limit: 500,
      maxBytes: 250000,
    });

    if (response) {
      logFile.value = response.file;
      cursor.value = response.cursor;

      if (response.reset || reset) {
        resetLineIdCounter();
        logLines.value = response.lines.map(parseLogLine);
      } else {
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

export function clearLogs(): void {
  logLines.value = [];
  cursor.value = 0;
  resetLineIdCounter();
}

export function downloadLogs(): void {
  const content = logLines.value.map((l) => l.raw).join("\n");
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `openclaw-logs-${new Date().toISOString().slice(0, 10)}.log`;
  a.click();
  URL.revokeObjectURL(url);
}

export function toggleLevel(level: LogLevel): void {
  toggleSetValue(selectedLevels, level);
}

export function clearLevelFilters(): void {
  selectedLevels.value = new Set();
}

export function openMobileLogDetails(id: number): void {
  pushQueryState();
  expandedLogs.value = new Set([id]);
}

export function closeMobileLogDetails(): void {
  expandedLogs.value = new Set();
}

export const filteredLines = computed(() => {
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

export const levelCounts = computed(() => {
  const counts = { debug: 0, info: 0, warn: 0, error: 0 };
  for (const line of logLines.value) {
    if (line.level && line.level in counts) {
      counts[line.level]++;
    }
  }
  return counts;
});

export function useLogsQuerySync(): void {
  const logsReady = !isLoading.value && logLines.value.length > 0;
  const [searchParam, setSearchParam] = useQueryParam("q");
  const [levelParam, setLevelParam] = useQueryParamSet<LogLevel>("level");
  const [liveParam, setLiveParam] = useQueryParam("live");
  const [expandedParam, setExpandedParam, expandedInitialized] = useQueryParamSet<number>("log", {
    ready: logsReady,
    parse: (s) => parseInt(s, 10),
  });

  useInitFromParam(searchParam, searchQuery, (s) => s);

  useEffect(() => {
    if (levelParam.value.size > 0) selectedLevels.value = levelParam.value;
    if (liveParam.value === "0") isLive.value = false;
  }, []);

  useSyncToParam(searchQuery, setSearchParam);

  useEffect(() => {
    setLevelParam(selectedLevels.value);
  }, [selectedLevels.value]);

  useEffect(() => {
    setLiveParam(isLive.value ? null : "0");
  }, [isLive.value]);

  useExpandableFromQueryParamSet<number>({
    ready: logsReady,
    expandedParam,
    expandedState: expandedLogs,
    expandedInitialized,
    setExpandedParam,
    isValid: (id) => logLines.value.some((l) => l.id === id),
    getItemSelector: (id) => `[data-log-id="${id}"]`,
  });
}

export function useLogsViewportTracking(): void {
  useEffect(() => {
    const updateViewport = () => {
      isMobileViewport.value = window.matchMedia("(max-width: 767px)").matches;
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);
}

export function useLogsInitialFetch(): void {
  useEffect(() => {
    if (isConnected.value) {
      void fetchLogs(true);
    }
  }, [isConnected.value]);
}

export function useLogsLivePolling(): void {
  useEffect(() => {
    if (!isLive.value || !isConnected.value) return;

    const interval = setInterval(() => {
      void fetchLogs();
    }, 2000);

    return () => clearInterval(interval);
  }, [isLive.value, isConnected.value]);
}
