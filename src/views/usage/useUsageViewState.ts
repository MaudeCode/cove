import { signal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { t } from "@/lib/i18n";
import { send, isConnected } from "@/lib/gateway";
import { useQueryParam, useInitFromParam, useSyncFilterToParam } from "@/hooks/useQueryParam";
import { getErrorMessage } from "@/lib/session-utils";
import { log } from "@/lib/logger";
import { toast } from "@/components/ui/Toast";
import { getSessionsUsageCache, setSessionsUsageCache } from "@/lib/storage";
import type {
  CostUsageSummary,
  HealthSummary,
  SessionsUsageResult,
  SessionUsageEntry,
  SessionUsageTimeSeries,
  SessionLogEntry,
} from "@/types/server-stats";

export const healthData = signal<HealthSummary | null>(null);
export const usageData = signal<CostUsageSummary | null>(null);
export const sessionsUsage = signal<SessionsUsageResult | null>(getSessionsUsageCache());
export const selectedSession = signal<SessionUsageEntry | null>(null);
export const isLoading = signal<boolean>(false);
export const isLoadingUsage = signal<boolean>(false);
export const isLoadingSessionsUsage = signal<boolean>(false);
export const error = signal<string | null>(null);
export const USAGE_DAY_OPTIONS = [7, 14, 30, 90] as const;
export const usageDays = signal<number>(30);
export type UsageTimezoneMode = "gateway" | "specific" | "utc";
export const usageTimezoneMode = signal<UsageTimezoneMode>("gateway");
export const sessionsSortBy = signal<"cost" | "tokens" | "recent">("recent");
export const sessionsSortDesc = signal<boolean>(true);
export const sessionsPage = signal<number>(0);
export const sessionsPageSize = 5;

export type DetailTab = "overview" | "timeline" | "messages";
export const detailTab = signal<DetailTab>("overview");
export const sessionTimeseries = signal<SessionUsageTimeSeries | null>(null);
export const sessionLogs = signal<SessionLogEntry[]>([]);
export const isLoadingTimeseries = signal<boolean>(false);
export const isLoadingLogs = signal<boolean>(false);
const sessionTimeseriesKey = signal<string | null>(null);
const sessionLogsKey = signal<string | null>(null);
let pendingUsageDays: number | null = null;
let usageLoadPromise: Promise<void> | null = null;
let currentUsageDays: number | null = null;
let activeSessionsUsageRequestKey: string | null = null;
let pendingSessionsUsageRequest: SessionsUsageRequest | null = null;
let sessionsUsageLoadPromise: Promise<void> | null = null;
let requestedSessionTimeseriesKey: string | null = null;
let pendingSessionTimeseriesKey: string | null = null;
let sessionTimeseriesLoadPromise: Promise<void> | null = null;
let requestedSessionLogsKey: string | null = null;
let pendingSessionLogsKey: string | null = null;
let sessionLogsLoadPromise: Promise<void> | null = null;

interface SessionsUsageRequest {
  days: number;
  key: string;
  params: {
    startDate: string;
    endDate: string;
    limit: 100;
    includeContextWeight: true;
    mode: UsageTimezoneMode;
    utcOffset?: string;
  };
}

function getBrowserUtcOffset(): string {
  const timezoneOffsetMinutes = -new Date().getTimezoneOffset();
  const sign = timezoneOffsetMinutes >= 0 ? "+" : "-";
  const absoluteMinutes = Math.abs(timezoneOffsetMinutes);
  const hours = Math.floor(absoluteMinutes / 60);
  const minutes = absoluteMinutes % 60;
  return `UTC${sign}${hours}${minutes === 0 ? "" : `:${String(minutes).padStart(2, "0")}`}`;
}

function createSessionsUsageRequest(days: number): SessionsUsageRequest {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const mode = usageTimezoneMode.value;
  const utcOffset = mode === "specific" ? getBrowserUtcOffset() : undefined;
  const params = {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
    limit: 100,
    includeContextWeight: true,
    mode,
    ...(utcOffset ? { utcOffset } : {}),
  } satisfies SessionsUsageRequest["params"];

  return {
    days,
    key: JSON.stringify(params),
    params,
  };
}

export async function loadHealth(): Promise<void> {
  isLoading.value = true;
  error.value = null;

  try {
    const result = await send("health", { probe: false });
    healthData.value = result;
  } catch (err) {
    error.value = getErrorMessage(err);
    toast.error(t("usage.loadError"));
  } finally {
    isLoading.value = false;
  }
}

export async function loadUsage(days: number = 30): Promise<void> {
  if (usageLoadPromise) {
    if (days === currentUsageDays) {
      pendingUsageDays = null;
      usageDays.value = days;
    } else if (days !== pendingUsageDays) {
      pendingUsageDays = days;
      usageDays.value = days;
    }
    return usageLoadPromise;
  }

  let currentDays = days;

  usageLoadPromise = (async () => {
    while (true) {
      pendingUsageDays = null;
      currentUsageDays = currentDays;
      usageDays.value = currentDays;

      try {
        isLoadingUsage.value = true;
        const result = await send("usage.cost", { days: currentDays });
        if (pendingUsageDays === null && usageDays.value === currentDays) {
          usageData.value = result;
        }
      } catch (err) {
        // Usage might not be available.
        log.usage.warn("Failed to load usage cost summary", { days: currentDays, err });
      } finally {
        isLoadingUsage.value = false;
      }

      const queuedDaysBeforeSessions = pendingUsageDays;
      if (queuedDaysBeforeSessions !== null) {
        currentDays = queuedDaysBeforeSessions;
        continue;
      }

      await loadSessionsUsage(currentDays);

      const queuedDays = pendingUsageDays;
      if (queuedDays === null) break;
      currentDays = queuedDays;
    }
  })();

  try {
    await usageLoadPromise;
  } finally {
    isLoadingUsage.value = false;
    currentUsageDays = null;
    usageLoadPromise = null;
  }
}

export async function loadSessionsUsage(days: number = 30): Promise<void> {
  const request = createSessionsUsageRequest(days);
  if (sessionsUsageLoadPromise) {
    if (request.key === activeSessionsUsageRequestKey) {
      pendingSessionsUsageRequest = null;
      usageDays.value = days;
    } else if (request.key !== pendingSessionsUsageRequest?.key) {
      pendingSessionsUsageRequest = request;
      usageDays.value = days;
    }
    return sessionsUsageLoadPromise;
  }

  isLoadingSessionsUsage.value = true;
  usageDays.value = days;
  let currentRequest = request;

  sessionsUsageLoadPromise = (async () => {
    while (true) {
      pendingSessionsUsageRequest = null;
      activeSessionsUsageRequestKey = currentRequest.key;

      try {
        const result = await send("sessions.usage", currentRequest.params);
        if (
          pendingSessionsUsageRequest === null &&
          usageDays.value === currentRequest.days &&
          activeSessionsUsageRequestKey === currentRequest.key
        ) {
          sessionsUsage.value = result;
          if (result) setSessionsUsageCache(result);
        }
      } catch (err) {
        log.usage.warn("Failed to load sessions usage", { days: currentRequest.days, err });
        if (!sessionsUsage.value) {
          sessionsUsage.value = null;
        }
      }

      const queuedRequest = pendingSessionsUsageRequest;
      if (queuedRequest === null) break;
      currentRequest = queuedRequest;
    }
  })();

  try {
    await sessionsUsageLoadPromise;
  } finally {
    isLoadingSessionsUsage.value = false;
    activeSessionsUsageRequestKey = null;
    sessionsUsageLoadPromise = null;
  }
}

export async function loadAll(): Promise<void> {
  await Promise.all([loadHealth(), loadUsage(usageDays.value)]);
}

export async function loadSessionTimeseries(key: string): Promise<void> {
  requestedSessionTimeseriesKey = key;
  if (sessionTimeseriesKey.value === key && sessionTimeseries.value) return;
  if (sessionTimeseriesLoadPromise) {
    pendingSessionTimeseriesKey = key;
    sessionTimeseriesKey.value = null;
    sessionTimeseries.value = null;
    return sessionTimeseriesLoadPromise;
  }

  isLoadingTimeseries.value = true;
  let currentKey = key;

  sessionTimeseriesLoadPromise = (async () => {
    while (true) {
      pendingSessionTimeseriesKey = null;
      sessionTimeseriesKey.value = null;
      sessionTimeseries.value = null;

      try {
        const result = await send("sessions.usage.timeseries", { key: currentKey });
        if (requestedSessionTimeseriesKey === currentKey) {
          sessionTimeseries.value = result;
          sessionTimeseriesKey.value = currentKey;
        }
      } catch (err) {
        // Timeseries may not be available.
        log.usage.warn("Failed to load session usage timeseries", { key: currentKey, err });
      }

      const queuedKey = pendingSessionTimeseriesKey;
      if (queuedKey === null || queuedKey === currentKey) break;
      currentKey = queuedKey;
    }
  })();

  try {
    await sessionTimeseriesLoadPromise;
  } finally {
    isLoadingTimeseries.value = false;
    sessionTimeseriesLoadPromise = null;
  }
}

export async function loadSessionLogs(key: string): Promise<void> {
  requestedSessionLogsKey = key;
  if (sessionLogsKey.value === key) return;
  if (sessionLogsLoadPromise) {
    pendingSessionLogsKey = key;
    sessionLogsKey.value = null;
    sessionLogs.value = [];
    return sessionLogsLoadPromise;
  }

  isLoadingLogs.value = true;
  let currentKey = key;

  sessionLogsLoadPromise = (async () => {
    while (true) {
      pendingSessionLogsKey = null;
      sessionLogsKey.value = null;
      sessionLogs.value = [];

      try {
        const result = await send("sessions.usage.logs", { key: currentKey, limit: 100 });
        if (requestedSessionLogsKey === currentKey) {
          sessionLogs.value = result?.logs ?? [];
          sessionLogsKey.value = currentKey;
        }
      } catch (err) {
        // Logs may not be available.
        log.usage.warn("Failed to load session usage logs", { key: currentKey, err });
      }

      const queuedKey = pendingSessionLogsKey;
      if (queuedKey === null || queuedKey === currentKey) break;
      currentKey = queuedKey;
    }
  })();

  try {
    await sessionLogsLoadPromise;
  } finally {
    isLoadingLogs.value = false;
    sessionLogsLoadPromise = null;
  }
}

export function clearSessionDetail(): void {
  selectedSession.value = null;
  detailTab.value = "overview";
  sessionTimeseries.value = null;
  sessionLogs.value = [];
  sessionTimeseriesKey.value = null;
  sessionLogsKey.value = null;
  requestedSessionTimeseriesKey = null;
  pendingSessionTimeseriesKey = null;
  requestedSessionLogsKey = null;
  pendingSessionLogsKey = null;
}

export function toggleSessionsSort(col: "cost" | "tokens" | "recent"): void {
  if (sessionsSortBy.value === col) {
    sessionsSortDesc.value = !sessionsSortDesc.value;
  } else {
    sessionsSortBy.value = col;
    sessionsSortDesc.value = true;
  }
  sessionsPage.value = 0;
}

export function toggleSelectedSession(session: SessionUsageEntry): void {
  selectedSession.value = selectedSession.value?.key === session.key ? null : session;
}

export async function loadSessionDetailTab(key: string, tab: DetailTab): Promise<void> {
  if (tab === "timeline") {
    await loadSessionTimeseries(key);
  } else if (tab === "messages") {
    await loadSessionLogs(key);
  }
}

export function useUsageViewQuerySync(): void {
  const sessionsReady = sessionsUsage.value !== null && sessionsUsage.value.sessions.length > 0;
  const [sessionParam, setSessionParam, sessionParamInitialized] = useQueryParam("session", {
    ready: sessionsReady,
  });
  const [daysParam, setDaysParam] = useQueryParam("days");
  const [sortParam, setSortParam] = useQueryParam("sort");

  useEffect(() => {
    if (!daysParam.value) return;
    const days = parseInt(daysParam.value, 10);
    if (
      USAGE_DAY_OPTIONS.includes(days as (typeof USAGE_DAY_OPTIONS)[number]) &&
      usageDays.value !== days
    ) {
      usageDays.value = days;
    }
  }, [daysParam.value]);

  useInitFromParam(sortParam, sessionsSortBy, (s) => s as "cost" | "tokens" | "recent");

  useEffect(() => {
    setDaysParam(usageDays.value === 30 ? null : String(usageDays.value));
  }, [usageDays.value]);

  useSyncFilterToParam(sessionsSortBy, setSortParam, "recent");

  useEffect(() => {
    if (!sessionsReady || !sessionParam.value) return;
    const session = sessionsUsage.value?.sessions.find((s) => s.key === sessionParam.value);
    if (session && selectedSession.value?.key !== session.key) {
      selectedSession.value = session;
    }
  }, [sessionParam.value, sessionsReady]);

  useEffect(() => {
    if (sessionParamInitialized.value) {
      setSessionParam(selectedSession.value?.key ?? null);
    }
  }, [selectedSession.value, sessionParamInitialized.value]);
}

export function useUsageViewInitialLoad(): void {
  useEffect(() => {
    if (isConnected.value) {
      void loadAll();
    }
  }, [isConnected.value]);
}
