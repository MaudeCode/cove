/**
 * SessionsAdminView
 *
 * Session management with clean table layout, search, and detail editing.
 * Designed to scale from 2 to 100+ sessions.
 * Route: /sessions
 */

import { signal, computed } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { route } from "preact-router";
import { t, formatTimestamp } from "@/lib/i18n";
import { send, isConnected } from "@/lib/gateway";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Dropdown } from "@/components/ui/Dropdown";
import { Spinner } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { IconButton } from "@/components/ui/IconButton";
import {
  RefreshCw,
  Search,
  MessageSquare,
  Calendar,
  Users,
  Radio,
  Cpu,
  Clock,
  Hash,
  Trash2,
  Settings2,
  ExternalLink,
  Sparkles,
} from "lucide-preact";
import type { Session } from "@/types/sessions";
import type { RouteProps } from "@/types/routes";

// ============================================
// Local State
// ============================================

const adminSessions = signal<Session[]>([]);
const isLoading = signal<boolean>(false);
const error = signal<string | null>(null);
const searchQuery = signal<string>("");
const kindFilter = signal<string>("all");
const selectedSession = signal<Session | null>(null);
const isDeleting = signal<boolean>(false);
const isSaving = signal<boolean>(false);

// Edit form state
const editLabel = signal<string>("");
const editThinking = signal<string>("inherit");
const editVerbose = signal<string>("inherit");
const editReasoning = signal<string>("inherit");

// ============================================
// Helpers
// ============================================

function getSessionKind(session: Session): string {
  if (session.key.includes(":cron:")) return "cron";
  if (session.channel || session.kind === "channel") return "channel";
  if (session.kind === "main" || session.key.includes(":main:main")) return "main";
  return "isolated";
}

function getSessionKindLabel(kind: string): string {
  switch (kind) {
    case "main":
      return t("sessions.admin.kinds.main");
    case "channel":
      return t("sessions.admin.kinds.channel");
    case "cron":
      return t("sessions.admin.kinds.cron");
    case "isolated":
      return t("sessions.admin.kinds.isolated");
    default:
      return kind;
  }
}

function getSessionIcon(kind: string) {
  switch (kind) {
    case "main":
      return Sparkles;
    case "channel":
      return Radio;
    case "cron":
      return Calendar;
    default:
      return MessageSquare;
  }
}

function getKindBadgeVariant(kind: string): "default" | "success" | "warning" | "error" | "info" {
  switch (kind) {
    case "main":
      return "success";
    case "channel":
      return "info";
    case "cron":
      return "warning";
    default:
      return "default";
  }
}

function formatTokens(session: Session): string {
  const used = session.totalTokens ?? 0;
  return used.toLocaleString();
}

function formatContextUsage(session: Session): string {
  const used = session.totalTokens ?? 0;
  const total = session.contextTokens ?? 200000;
  if (total === 0) return "0%";
  return `${Math.round((used / total) * 100)}%`;
}

// ============================================
// Computed
// ============================================

const filteredSessions = computed(() => {
  let result = adminSessions.value;

  // Filter by kind
  if (kindFilter.value !== "all") {
    result = result.filter((s) => getSessionKind(s) === kindFilter.value);
  }

  // Filter by search
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

  // Sort: main first, then by last active
  return [...result].sort((a, b) => {
    const aIsMain = getSessionKind(a) === "main";
    const bIsMain = getSessionKind(b) === "main";
    if (aIsMain && !bIsMain) return -1;
    if (bIsMain && !aIsMain) return 1;
    return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
  });
});

const sessionCounts = computed(() => {
  const sessions = adminSessions.value;
  return {
    total: sessions.length,
    main: sessions.filter((s) => getSessionKind(s) === "main").length,
    channel: sessions.filter((s) => getSessionKind(s) === "channel").length,
    cron: sessions.filter((s) => getSessionKind(s) === "cron").length,
    isolated: sessions.filter((s) => getSessionKind(s) === "isolated").length,
  };
});

// ============================================
// Actions
// ============================================

async function loadAdminSessions(): Promise<void> {
  isLoading.value = true;
  error.value = null;

  try {
    const result = await send<{ sessions: Session[] }>("sessions.list", {
      limit: 200,
    });
    adminSessions.value = result.sessions ?? [];
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    isLoading.value = false;
  }
}

function openSessionDetail(session: Session) {
  selectedSession.value = session;
  editLabel.value = session.label ?? "";
  editThinking.value = ((session as Record<string, unknown>).thinking as string) ?? "inherit";
  editVerbose.value = ((session as Record<string, unknown>).verbose as string) ?? "inherit";
  editReasoning.value = ((session as Record<string, unknown>).reasoning as string) ?? "inherit";
}

function closeSessionDetail() {
  selectedSession.value = null;
  isDeleting.value = false;
}

async function saveSession(): Promise<void> {
  const session = selectedSession.value;
  if (!session) return;

  isSaving.value = true;

  try {
    const updates: Record<string, unknown> = {};

    if (editLabel.value !== (session.label ?? "")) {
      updates.label = editLabel.value || undefined;
    }
    if (editThinking.value !== ((session as Record<string, unknown>).thinking ?? "inherit")) {
      updates.thinking = editThinking.value;
    }
    if (editVerbose.value !== ((session as Record<string, unknown>).verbose ?? "inherit")) {
      updates.verbose = editVerbose.value;
    }
    if (editReasoning.value !== ((session as Record<string, unknown>).reasoning ?? "inherit")) {
      updates.reasoning = editReasoning.value;
    }

    if (Object.keys(updates).length > 0) {
      await send("sessions.patch", { key: session.key, ...updates });

      // Update local state
      adminSessions.value = adminSessions.value.map((s) =>
        s.key === session.key ? { ...s, ...updates } : s,
      );
    }

    closeSessionDetail();
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    isSaving.value = false;
  }
}

async function deleteSession(): Promise<void> {
  const session = selectedSession.value;
  if (!session) return;

  try {
    await send("sessions.delete", { key: session.key });
    adminSessions.value = adminSessions.value.filter((s) => s.key !== session.key);
    closeSessionDetail();
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  }
}

function openInChat(sessionKey: string) {
  route(`/chat/${encodeURIComponent(sessionKey)}`);
}

// ============================================
// Components
// ============================================

const LEVEL_OPTIONS = [
  { value: "inherit", label: t("sessions.admin.levels.inherit") },
  { value: "off", label: t("sessions.admin.levels.off") },
  { value: "low", label: t("sessions.admin.levels.low") },
  { value: "medium", label: t("sessions.admin.levels.medium") },
  { value: "high", label: t("sessions.admin.levels.high") },
];

const KIND_FILTER_OPTIONS = [
  { value: "all", label: t("sessions.admin.filters.all") },
  { value: "main", label: t("sessions.admin.kinds.main") },
  { value: "channel", label: t("sessions.admin.kinds.channel") },
  { value: "cron", label: t("sessions.admin.kinds.cron") },
  { value: "isolated", label: t("sessions.admin.kinds.isolated") },
];

function StatCard({
  icon: Icon,
  label,
  value,
  active,
  onClick,
}: {
  icon: typeof MessageSquare;
  label: string;
  value: number;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      class={`
        flex items-center gap-3 p-4 rounded-xl text-left transition-all
        ${
          active
            ? "bg-[var(--color-accent)]/10 border-2 border-[var(--color-accent)]"
            : "bg-[var(--color-bg-secondary)] border-2 border-transparent hover:bg-[var(--color-bg-tertiary)]"
        }
      `}
    >
      <div
        class={`p-2 rounded-lg ${active ? "bg-[var(--color-accent)]/20" : "bg-[var(--color-bg-tertiary)]"}`}
      >
        <Icon
          class={`w-5 h-5 ${active ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)]"}`}
        />
      </div>
      <div>
        <div class="text-2xl font-bold">{value}</div>
        <div class="text-sm text-[var(--color-text-muted)]">{label}</div>
      </div>
    </button>
  );
}

function SessionRow({ session }: { session: Session }) {
  const kind = getSessionKind(session);
  const Icon = getSessionIcon(kind);
  const displayName =
    session.label || session.displayName || session.key.split(":").pop() || session.key;

  return (
    <tr
      class="group hover:bg-[var(--color-bg-hover)] cursor-pointer transition-colors"
      onClick={() => openSessionDetail(session)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openSessionDetail(session);
        }
      }}
      tabIndex={0}
    >
      {/* Name & Key */}
      <td class="py-3 px-4">
        <div class="flex items-center gap-3">
          <div
            class={`p-1.5 rounded-lg ${
              kind === "main"
                ? "bg-[var(--color-success)]/10"
                : kind === "channel"
                  ? "bg-[var(--color-info)]/10"
                  : kind === "cron"
                    ? "bg-[var(--color-warning)]/10"
                    : "bg-[var(--color-bg-tertiary)]"
            }`}
          >
            <Icon
              class={`w-4 h-4 ${
                kind === "main"
                  ? "text-[var(--color-success)]"
                  : kind === "channel"
                    ? "text-[var(--color-info)]"
                    : kind === "cron"
                      ? "text-[var(--color-warning)]"
                      : "text-[var(--color-text-muted)]"
              }`}
            />
          </div>
          <div class="min-w-0">
            <div class="font-medium truncate max-w-[200px]" title={displayName}>
              {displayName}
            </div>
            <div
              class="text-xs text-[var(--color-text-muted)] font-mono truncate max-w-[200px]"
              title={session.key}
            >
              {session.key}
            </div>
          </div>
        </div>
      </td>

      {/* Kind */}
      <td class="py-3 px-4">
        <Badge variant={getKindBadgeVariant(kind)} size="sm">
          {getSessionKindLabel(kind)}
        </Badge>
      </td>

      {/* Model */}
      <td class="py-3 px-4">
        <div class="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
          <Cpu class="w-3.5 h-3.5" />
          <span class="truncate max-w-[120px]" title={session.model || "Default"}>
            {session.model ? session.model.split("/").pop() : "Default"}
          </span>
        </div>
      </td>

      {/* Last Active */}
      <td class="py-3 px-4">
        <div class="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
          <Clock class="w-3.5 h-3.5" />
          <span>{session.updatedAt ? formatTimestamp(session.updatedAt) : "—"}</span>
        </div>
      </td>

      {/* Tokens */}
      <td class="py-3 px-4">
        <div class="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
          <Hash class="w-3.5 h-3.5" />
          <span>{formatTokens(session)}</span>
          <span class="text-xs opacity-60">({formatContextUsage(session)})</span>
        </div>
      </td>

      {/* Actions */}
      <td class="py-3 px-4">
        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <IconButton
            icon={<ExternalLink class="w-4 h-4" />}
            label={t("sessions.admin.openInChat")}
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              openInChat(session.key);
            }}
          />
          <IconButton
            icon={<Settings2 class="w-4 h-4" />}
            label={t("sessions.admin.configure")}
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              openSessionDetail(session);
            }}
          />
        </div>
      </td>
    </tr>
  );
}

function SessionDetailModal() {
  const session = selectedSession.value;
  if (!session) return null;

  const kind = getSessionKind(session);

  return (
    <Modal
      open={!!session}
      onClose={closeSessionDetail}
      title={session.label || session.displayName || t("sessions.admin.sessionDetails")}
      size="lg"
      footer={
        <div class="flex items-center justify-between">
          <div>
            {isDeleting.value ? (
              <div class="flex items-center gap-2">
                <span class="text-sm text-[var(--color-error)]">
                  {t("sessions.admin.confirmDelete")}
                </span>
                <Button size="sm" variant="ghost" onClick={() => (isDeleting.value = false)}>
                  {t("actions.cancel")}
                </Button>
                <Button size="sm" variant="danger" onClick={deleteSession}>
                  {t("actions.delete")}
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => (isDeleting.value = true)}
                class="text-[var(--color-error)] hover:bg-[var(--color-error)]/10"
              >
                <Trash2 class="w-4 h-4 mr-1.5" />
                {t("actions.delete")}
              </Button>
            )}
          </div>
          <div class="flex items-center gap-2">
            <Button variant="secondary" onClick={closeSessionDetail}>
              {t("actions.cancel")}
            </Button>
            <Button onClick={saveSession} disabled={isSaving.value}>
              {isSaving.value ? <Spinner size="sm" /> : t("actions.save")}
            </Button>
          </div>
        </div>
      }
    >
      <div class="space-y-6">
        {/* Session Info */}
        <div class="flex items-start gap-4 p-4 rounded-xl bg-[var(--color-bg-secondary)]">
          <div
            class={`p-3 rounded-xl ${
              kind === "main"
                ? "bg-[var(--color-success)]/10"
                : kind === "channel"
                  ? "bg-[var(--color-info)]/10"
                  : kind === "cron"
                    ? "bg-[var(--color-warning)]/10"
                    : "bg-[var(--color-bg-tertiary)]"
            }`}
          >
            {(() => {
              const Icon = getSessionIcon(kind);
              return (
                <Icon
                  class={`w-6 h-6 ${
                    kind === "main"
                      ? "text-[var(--color-success)]"
                      : kind === "channel"
                        ? "text-[var(--color-info)]"
                        : kind === "cron"
                          ? "text-[var(--color-warning)]"
                          : "text-[var(--color-text-muted)]"
                  }`}
                />
              );
            })()}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <Badge variant={getKindBadgeVariant(kind)} size="sm">
                {getSessionKindLabel(kind)}
              </Badge>
              {session.channel && (
                <Badge variant="default" size="sm">
                  {session.channel}
                </Badge>
              )}
            </div>
            <code class="text-sm text-[var(--color-text-muted)] break-all">{session.key}</code>
          </div>
        </div>

        {/* Stats */}
        <div class="grid grid-cols-3 gap-4">
          <div class="text-center p-3 rounded-xl bg-[var(--color-bg-secondary)]">
            <div class="text-lg font-semibold">{formatTokens(session)}</div>
            <div class="text-xs text-[var(--color-text-muted)]">{t("sessions.admin.tokens")}</div>
          </div>
          <div class="text-center p-3 rounded-xl bg-[var(--color-bg-secondary)]">
            <div class="text-lg font-semibold">{formatContextUsage(session)}</div>
            <div class="text-xs text-[var(--color-text-muted)]">
              {t("sessions.admin.contextUsed")}
            </div>
          </div>
          <div class="text-center p-3 rounded-xl bg-[var(--color-bg-secondary)]">
            <div class="text-lg font-semibold">
              {session.updatedAt ? formatTimestamp(session.updatedAt, { relative: true }) : "—"}
            </div>
            <div class="text-xs text-[var(--color-text-muted)]">
              {t("sessions.admin.lastActive")}
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1.5">{t("sessions.admin.label")}</label>
            <Input
              value={editLabel.value}
              onInput={(e) => (editLabel.value = (e.target as HTMLInputElement).value)}
              placeholder={t("sessions.admin.labelPlaceholder")}
            />
            <p class="text-xs text-[var(--color-text-muted)] mt-1">
              {t("sessions.admin.labelHelp")}
            </p>
          </div>

          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1.5">{t("sessions.admin.thinking")}</label>
              <Dropdown
                value={editThinking.value}
                onChange={(val) => (editThinking.value = val)}
                options={LEVEL_OPTIONS}
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1.5">{t("sessions.admin.verbose")}</label>
              <Dropdown
                value={editVerbose.value}
                onChange={(val) => (editVerbose.value = val)}
                options={LEVEL_OPTIONS}
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1.5">
                {t("sessions.admin.reasoning")}
              </label>
              <Dropdown
                value={editReasoning.value}
                onChange={(val) => (editReasoning.value = val)}
                options={LEVEL_OPTIONS}
              />
            </div>
          </div>
        </div>

        {/* Open in Chat */}
        <Button
          variant="secondary"
          class="w-full"
          onClick={() => {
            closeSessionDetail();
            openInChat(session.key);
          }}
        >
          <ExternalLink class="w-4 h-4 mr-2" />
          {t("sessions.admin.openInChat")}
        </Button>
      </div>
    </Modal>
  );
}

// ============================================
// Main View
// ============================================

export function SessionsAdminView(_props: RouteProps) {
  // Load sessions when connected
  useEffect(() => {
    if (isConnected.value) {
      loadAdminSessions();
    }
  }, [isConnected.value]);

  const counts = sessionCounts.value;

  return (
    <div class="flex-1 overflow-y-auto p-6">
      <div class="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div class="flex items-start justify-between">
          <div>
            <h1 class="text-2xl font-bold">{t("sessions.admin.title")}</h1>
            <p class="text-[var(--color-text-muted)] mt-1">{t("sessions.admin.description")}</p>
          </div>
          <Button
            onClick={loadAdminSessions}
            disabled={isLoading.value || !isConnected.value}
            variant="secondary"
          >
            <RefreshCw class={`w-4 h-4 mr-2 ${isLoading.value ? "animate-spin" : ""}`} />
            {t("actions.refresh")}
          </Button>
        </div>

        {/* Stats Cards */}
        {isConnected.value && !isLoading.value && (
          <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard
              icon={MessageSquare}
              label={t("sessions.admin.stats.total")}
              value={counts.total}
              active={kindFilter.value === "all"}
              onClick={() => (kindFilter.value = "all")}
            />
            <StatCard
              icon={Sparkles}
              label={t("sessions.admin.kinds.main")}
              value={counts.main}
              active={kindFilter.value === "main"}
              onClick={() => (kindFilter.value = "main")}
            />
            <StatCard
              icon={Radio}
              label={t("sessions.admin.kinds.channel")}
              value={counts.channel}
              active={kindFilter.value === "channel"}
              onClick={() => (kindFilter.value = "channel")}
            />
            <StatCard
              icon={Calendar}
              label={t("sessions.admin.kinds.cron")}
              value={counts.cron}
              active={kindFilter.value === "cron"}
              onClick={() => (kindFilter.value = "cron")}
            />
            <StatCard
              icon={Users}
              label={t("sessions.admin.kinds.isolated")}
              value={counts.isolated}
              active={kindFilter.value === "isolated"}
              onClick={() => (kindFilter.value = "isolated")}
            />
          </div>
        )}

        {/* Search & Filters */}
        {isConnected.value && !isLoading.value && adminSessions.value.length > 0 && (
          <div class="flex items-center gap-4">
            <div class="relative flex-1 max-w-md">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
              <Input
                type="text"
                value={searchQuery.value}
                onInput={(e) => (searchQuery.value = (e.target as HTMLInputElement).value)}
                placeholder={t("sessions.admin.searchPlaceholder")}
                class="pl-10"
              />
            </div>
            <Dropdown
              value={kindFilter.value}
              onChange={(val) => (kindFilter.value = val)}
              options={KIND_FILTER_OPTIONS}
            />
          </div>
        )}

        {/* Error */}
        {error.value && (
          <div class="p-4 rounded-xl bg-[var(--color-error)]/10 text-[var(--color-error)]">
            {error.value}
          </div>
        )}

        {/* Loading / Connecting */}
        {(isLoading.value || !isConnected.value) && (
          <div class="flex justify-center py-16">
            <Spinner size="lg" label={!isConnected.value ? t("status.connecting") : undefined} />
          </div>
        )}

        {/* Sessions Table */}
        {isConnected.value && !isLoading.value && filteredSessions.value.length > 0 && (
          <Card padding="none">
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="border-b border-[var(--color-border)] text-left text-sm text-[var(--color-text-muted)]">
                    <th class="py-3 px-4 font-medium">{t("sessions.admin.columns.session")}</th>
                    <th class="py-3 px-4 font-medium">{t("sessions.admin.columns.kind")}</th>
                    <th class="py-3 px-4 font-medium">{t("sessions.admin.columns.model")}</th>
                    <th class="py-3 px-4 font-medium">{t("sessions.admin.columns.lastActive")}</th>
                    <th class="py-3 px-4 font-medium">{t("sessions.admin.columns.tokens")}</th>
                    <th class="py-3 px-4 font-medium w-20"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[var(--color-border)]">
                  {filteredSessions.value.map((session) => (
                    <SessionRow key={session.key} session={session} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Empty state */}
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

        {/* No results from filter */}
        {isConnected.value &&
          !isLoading.value &&
          adminSessions.value.length > 0 &&
          filteredSessions.value.length === 0 && (
            <Card>
              <div class="p-12 text-center">
                <Search class="w-10 h-10 mx-auto mb-4 text-[var(--color-text-muted)] opacity-50" />
                <h3 class="text-lg font-medium mb-2">{t("sessions.admin.noResults")}</h3>
                <p class="text-[var(--color-text-muted)] mb-4">
                  {t("sessions.admin.noResultsDescription")}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    searchQuery.value = "";
                    kindFilter.value = "all";
                  }}
                >
                  {t("sessions.admin.clearFilters")}
                </Button>
              </div>
            </Card>
          )}

        {/* Footer count */}
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
      </div>

      {/* Detail Modal */}
      <SessionDetailModal />
    </div>
  );
}
