import { signal, computed } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { route } from "preact-router";
import { t } from "@/lib/i18n";
import { send, isConnected } from "@/lib/gateway";
import {
  useQueryParam,
  useSyncToParam,
  useSyncFilterToParam,
  useInitFromParam,
} from "@/hooks/useQueryParam";
import { getSessionDisplayKind, getErrorMessage, type SessionKind } from "@/lib/session-utils";
import type { Session } from "@/types/sessions";
import type { LucideIcon } from "lucide-preact";
import { Sparkles, Radio, Calendar, Users } from "lucide-preact";

export interface KindStyle {
  icon: LucideIcon;
  color: string;
  badgeVariant: "default" | "success" | "warning" | "error" | "info";
}

const KIND_STYLES: Record<SessionKind, KindStyle> = {
  main: { icon: Sparkles, color: "success", badgeVariant: "success" },
  channel: { icon: Radio, color: "info", badgeVariant: "info" },
  cron: { icon: Calendar, color: "warning", badgeVariant: "warning" },
  isolated: { icon: Users, color: "text-muted", badgeVariant: "default" },
};

export function getKindStyle(kind: SessionKind): KindStyle {
  return KIND_STYLES[kind] ?? KIND_STYLES.isolated;
}

export function getKindLabel(kind: SessionKind): string {
  return t(`sessions.admin.kinds.${kind}`);
}

export const adminSessions = signal<Session[]>([]);
export const isLoading = signal<boolean>(false);
export const error = signal<string | null>(null);
export const searchQuery = signal<string>("");
export const kindFilter = signal<string>("all");
export const selectedSession = signal<Session | null>(null);
export const isDeleting = signal<boolean>(false);
export const isSaving = signal<boolean>(false);

export const inlineEditKey = signal<string | null>(null);
export const inlineEditValue = signal<string>("");

export const editLabel = signal<string>("");
export const editThinking = signal<string>("inherit");
export const editVerbose = signal<string>("inherit");
export const editReasoning = signal<string>("inherit");

export function formatTokenCount(session: Session): string {
  return (session.totalTokens ?? 0).toLocaleString();
}

export function formatContextUsage(session: Session): string {
  const used = session.totalTokens ?? 0;
  const total = session.contextTokens ?? 200000;
  if (total === 0) return "0%";
  return `${Math.round((used / total) * 100)}%`;
}

export function getDisplayName(session: Session): string {
  return session.displayName || session.label || session.key.split(":").pop() || session.key;
}

export const filteredSessions = computed(() => {
  let result = adminSessions.value;

  if (kindFilter.value !== "all") {
    result = result.filter((s) => getSessionDisplayKind(s) === kindFilter.value);
  }

  const query = searchQuery.value.toLowerCase().trim();
  if (query) {
    result = result.filter((s) => {
      const label = (s.label || s.displayName || "").toLowerCase();
      const key = s.key.toLowerCase();
      const model = (s.model || "").toLowerCase();
      const channel = (s.channel || "").toLowerCase();
      return (
        label.includes(query) ||
        key.includes(query) ||
        model.includes(query) ||
        channel.includes(query)
      );
    });
  }

  return [...result].sort((a, b) => {
    const aIsMain = getSessionDisplayKind(a) === "main";
    const bIsMain = getSessionDisplayKind(b) === "main";
    if (aIsMain && !bIsMain) return -1;
    if (bIsMain && !aIsMain) return 1;
    return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
  });
});

export const sessionCounts = computed(() => {
  const counts = { total: 0, main: 0, channel: 0, cron: 0, isolated: 0 };
  for (const session of adminSessions.value) {
    counts.total++;
    counts[getSessionDisplayKind(session)]++;
  }
  return counts;
});

export async function loadAdminSessions(): Promise<void> {
  isLoading.value = true;
  error.value = null;

  try {
    const result = await send("sessions.list", { limit: 200 });
    adminSessions.value = result.sessions ?? [];
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    isLoading.value = false;
  }
}

export function openSessionDetail(session: Session): void {
  selectedSession.value = session;
  editLabel.value = session.label ?? "";
  editThinking.value = session.thinking ?? "inherit";
  editVerbose.value = session.verbose ?? "inherit";
  editReasoning.value = session.reasoning ?? "inherit";
}

export function closeSessionDetail(): void {
  selectedSession.value = null;
  isDeleting.value = false;
}

export async function saveSession(): Promise<void> {
  const session = selectedSession.value;
  if (!session) return;

  isSaving.value = true;

  try {
    const updates: Partial<Session> = {};

    if (editLabel.value !== (session.label ?? "")) {
      updates.label = editLabel.value || undefined;
    }
    if (editThinking.value !== (session.thinking ?? "inherit")) {
      updates.thinking = editThinking.value;
    }
    if (editVerbose.value !== (session.verbose ?? "inherit")) {
      updates.verbose = editVerbose.value;
    }
    if (editReasoning.value !== (session.reasoning ?? "inherit")) {
      updates.reasoning = editReasoning.value;
    }

    if (Object.keys(updates).length > 0) {
      await send("sessions.patch", { key: session.key, ...updates });
      adminSessions.value = adminSessions.value.map((s) =>
        s.key === session.key ? { ...s, ...updates } : s,
      );
    }

    closeSessionDetail();
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    isSaving.value = false;
  }
}

export async function deleteSession(): Promise<void> {
  const session = selectedSession.value;
  if (!session) return;

  try {
    await send("sessions.delete", { key: session.key });
    adminSessions.value = adminSessions.value.filter((s) => s.key !== session.key);
    closeSessionDetail();
  } catch (err) {
    error.value = getErrorMessage(err);
  }
}

export function openInChat(sessionKey: string): void {
  route(`/chat/${encodeURIComponent(sessionKey)}`);
}

export function startInlineEdit(session: Session, e: Event): void {
  e.stopPropagation();
  inlineEditKey.value = session.key;
  inlineEditValue.value = session.label ?? "";
}

export async function saveInlineEdit(): Promise<void> {
  const sessionKey = inlineEditKey.value;
  if (!sessionKey) return;

  const newLabel = inlineEditValue.value.trim();
  const session = adminSessions.value.find((s) => s.key === sessionKey);
  if (!session || newLabel === (session.label ?? "")) {
    inlineEditKey.value = null;
    return;
  }

  try {
    await send("sessions.patch", { key: sessionKey, label: newLabel || undefined });
    adminSessions.value = adminSessions.value.map((s) =>
      s.key === sessionKey ? { ...s, label: newLabel || undefined } : s,
    );
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    inlineEditKey.value = null;
  }
}

export function cancelInlineEdit(): void {
  inlineEditKey.value = null;
}

export function useSessionsAdminQuerySync(): void {
  const [searchParam, setSearchParam] = useQueryParam("q");
  const [kindParam, setKindParam] = useQueryParam("kind");
  const sessionsReady = !isLoading.value && adminSessions.value.length > 0;
  const [sessionParam, setSessionParam, sessionParamInitialized] = useQueryParam("session", {
    ready: sessionsReady,
  });

  useInitFromParam(searchParam, searchQuery, (s) => s);
  useInitFromParam(kindParam, kindFilter, (s) => s);

  useSyncToParam(searchQuery, setSearchParam);
  useSyncFilterToParam(kindFilter, setKindParam, "all");

  useEffect(() => {
    if (sessionsReady && sessionParam.value) {
      const session = adminSessions.value.find((s) => s.key === sessionParam.value);
      if (session && selectedSession.value?.key !== session.key) {
        openSessionDetail(session);
      }
    }
  }, [sessionParam.value, sessionsReady]);

  useEffect(() => {
    if (sessionParamInitialized.value) {
      setSessionParam(selectedSession.value?.key ?? null);
    }
  }, [selectedSession.value, sessionParamInitialized.value]);
}

export function useSessionsAdminInitialLoad(): void {
  useEffect(() => {
    if (isConnected.value) {
      void loadAdminSessions();
    }
  }, [isConnected.value]);
}
