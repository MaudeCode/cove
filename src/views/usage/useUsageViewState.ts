import { signal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { t } from "@/lib/i18n";
import { send, isConnected } from "@/lib/gateway";
import { useQueryParam, useInitFromParam, useSyncFilterToParam } from "@/hooks/useQueryParam";
import { getErrorMessage } from "@/lib/session-utils";
import { toast } from "@/components/ui/Toast";
import { getSessionsUsageCache, setSessionsUsageCache } from "@/lib/storage";
import type {
  CostUsageSummary,
  HealthSummary,
  SessionsUsageResult,
  SessionUsageEntry,
  SessionUsageTimeSeries,
  SessionLogsResult,
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
export const usageDays = signal<number>(30);
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

export async function loadHealth(): Promise<void> {
  isLoading.value = true;
  error.value = null;

  try {
    const result = await send<HealthSummary>("health", { probe: false });
    healthData.value = result;
  } catch (err) {
    error.value = getErrorMessage(err);
    toast.error(t("usage.loadError"));
  } finally {
    isLoading.value = false;
  }
}

export async function loadUsage(days: number = 30): Promise<void> {
  isLoadingUsage.value = true;
  usageDays.value = days;

  try {
    const result = await send<CostUsageSummary>("usage.cost", { days });
    usageData.value = result;
  } catch {
    // Usage might not be available.
  } finally {
    isLoadingUsage.value = false;
  }

  void loadSessionsUsage(days);
}

export async function loadSessionsUsage(days: number = 30): Promise<void> {
  if (isLoadingSessionsUsage.value) return;
  isLoadingSessionsUsage.value = true;

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await send<SessionsUsageResult>("sessions.usage", {
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
      limit: 100,
      includeContextWeight: true,
    });
    sessionsUsage.value = result;
    if (result) setSessionsUsageCache(result);
  } catch {
    if (!sessionsUsage.value) {
      sessionsUsage.value = null;
    }
  } finally {
    isLoadingSessionsUsage.value = false;
  }
}

export async function loadAll(): Promise<void> {
  await Promise.all([loadHealth(), loadUsage(usageDays.value)]);
}

export async function loadSessionTimeseries(key: string): Promise<void> {
  if (isLoadingTimeseries.value) return;
  isLoadingTimeseries.value = true;
  sessionTimeseries.value = null;

  try {
    const result = await send<SessionUsageTimeSeries>("sessions.usage.timeseries", { key });
    sessionTimeseries.value = result;
  } catch {
    // Timeseries may not be available.
  } finally {
    isLoadingTimeseries.value = false;
  }
}

export async function loadSessionLogs(key: string): Promise<void> {
  if (isLoadingLogs.value) return;
  isLoadingLogs.value = true;
  sessionLogs.value = [];

  try {
    const result = await send<SessionLogsResult>("sessions.usage.logs", { key, limit: 100 });
    sessionLogs.value = result?.logs ?? [];
  } catch {
    // Logs may not be available.
  } finally {
    isLoadingLogs.value = false;
  }
}

export function clearSessionDetail(): void {
  selectedSession.value = null;
  detailTab.value = "overview";
  sessionTimeseries.value = null;
  sessionLogs.value = [];
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
    if ([7, 30, 90].includes(days) && usageDays.value !== days) {
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
