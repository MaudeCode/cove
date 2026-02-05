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
import { isMultiChatMode } from "@/signals/settings";
import { getSessionDisplayKind, getErrorMessage, type SessionKind } from "@/lib/session-utils";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Dropdown } from "@/components/ui/Dropdown";
import { Spinner } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { IconButton } from "@/components/ui/IconButton";
import { FormField } from "@/components/ui/FormField";
import { StatCard } from "@/components/ui/StatCard";
import { PageHeader } from "@/components/ui/PageHeader";
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
  Pencil,
  Sparkles,
} from "lucide-preact";
import { ViewErrorBoundary } from "@/components/ui/ViewErrorBoundary";
import type { Session } from "@/types/sessions";
import type { RouteProps } from "@/types/routes";
import type { ComponentType } from "preact";

// ============================================
// Kind Styling Config (single source of truth)
// ============================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IconComponent = ComponentType<any>;

interface KindStyle {
  icon: IconComponent;
  color: string; // CSS variable name without var()
  badgeVariant: "default" | "success" | "warning" | "error" | "info";
}

const KIND_STYLES: Record<SessionKind, KindStyle> = {
  main: { icon: Sparkles, color: "success", badgeVariant: "success" },
  channel: { icon: Radio, color: "info", badgeVariant: "info" },
  cron: { icon: Calendar, color: "warning", badgeVariant: "warning" },
  isolated: { icon: Users, color: "text-muted", badgeVariant: "default" },
};

function getKindStyle(kind: SessionKind): KindStyle {
  return KIND_STYLES[kind] ?? KIND_STYLES.isolated;
}

function getKindLabel(kind: SessionKind): string {
  return t(`sessions.admin.kinds.${kind}`);
}

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

// Inline edit state
const inlineEditKey = signal<string | null>(null);
const inlineEditValue = signal<string>("");

// Edit form state
const editLabel = signal<string>("");
const editThinking = signal<string>("inherit");
const editVerbose = signal<string>("inherit");
const editReasoning = signal<string>("inherit");

// ============================================
// Helpers
// ============================================

function formatTokenCount(session: Session): string {
  return (session.totalTokens ?? 0).toLocaleString();
}

function formatContextUsage(session: Session): string {
  const used = session.totalTokens ?? 0;
  const total = session.contextTokens ?? 200000;
  if (total === 0) return "0%";
  return `${Math.round((used / total) * 100)}%`;
}

function getDisplayName(session: Session): string {
  return session.label || session.displayName || session.key.split(":").pop() || session.key;
}

// ============================================
// Computed
// ============================================

const filteredSessions = computed(() => {
  let result = adminSessions.value;

  // Filter by kind
  if (kindFilter.value !== "all") {
    result = result.filter((s) => getSessionDisplayKind(s) === kindFilter.value);
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
    const aIsMain = getSessionDisplayKind(a) === "main";
    const bIsMain = getSessionDisplayKind(b) === "main";
    if (aIsMain && !bIsMain) return -1;
    if (bIsMain && !aIsMain) return 1;
    return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
  });
});

const sessionCounts = computed(() => {
  const counts = { total: 0, main: 0, channel: 0, cron: 0, isolated: 0 };
  for (const session of adminSessions.value) {
    counts.total++;
    counts[getSessionDisplayKind(session)]++;
  }
  return counts;
});

// ============================================
// Actions
// ============================================

async function loadAdminSessions(): Promise<void> {
  isLoading.value = true;
  error.value = null;

  try {
    const result = await send<{ sessions: Session[] }>("sessions.list", { limit: 200 });
    adminSessions.value = result.sessions ?? [];
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    isLoading.value = false;
  }
}

function openSessionDetail(session: Session) {
  selectedSession.value = session;
  editLabel.value = session.label ?? "";
  editThinking.value = session.thinking ?? "inherit";
  editVerbose.value = session.verbose ?? "inherit";
  editReasoning.value = session.reasoning ?? "inherit";
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

async function deleteSession(): Promise<void> {
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

function openInChat(sessionKey: string) {
  route(`/chat/${encodeURIComponent(sessionKey)}`);
}

// Inline label editing
function startInlineEdit(session: Session, e: Event) {
  e.stopPropagation();
  inlineEditKey.value = session.key;
  inlineEditValue.value = session.label ?? "";
}

async function saveInlineEdit() {
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

function cancelInlineEdit() {
  inlineEditKey.value = null;
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

/** Icon with kind-appropriate coloring */
function KindIcon({ kind, size = "sm" }: { kind: SessionKind; size?: "sm" | "md" }) {
  const style = getKindStyle(kind);
  const Icon = style.icon;
  const sizeClass = size === "md" ? "w-6 h-6" : "w-4 h-4";
  const colorClass =
    style.color === "text-muted"
      ? "text-[var(--color-text-muted)]"
      : `text-[var(--color-${style.color})]`;

  return <Icon class={`${sizeClass} ${colorClass}`} />;
}

/** Background wrapper for kind icon */
function KindIconWrapper({ kind, size = "sm" }: { kind: SessionKind; size?: "sm" | "md" }) {
  const style = getKindStyle(kind);
  const padding = size === "md" ? "p-3" : "p-1.5";
  const bgClass =
    style.color === "text-muted"
      ? "bg-[var(--color-bg-tertiary)]"
      : `bg-[var(--color-${style.color})]/10`;

  return (
    <div class={`${padding} rounded-lg flex-shrink-0 ${bgClass}`}>
      <KindIcon kind={kind} size={size} />
    </div>
  );
}

/** Mobile card view for a session */
function SessionCard({ session }: { session: Session }) {
  const kind = getSessionDisplayKind(session);
  const style = getKindStyle(kind);
  const displayName = getDisplayName(session);

  return (
    <button
      type="button"
      class="w-full p-3 rounded-lg bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-hover)] cursor-pointer transition-colors text-left"
      onClick={() => openSessionDetail(session)}
    >
      <div class="flex items-start gap-3">
        <KindIconWrapper kind={kind} />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-0.5">
            <span class="font-medium truncate">{displayName}</span>
            <Badge variant={style.badgeVariant} size="sm">
              {getKindLabel(kind)}
            </Badge>
          </div>
          <div class="text-xs text-[var(--color-text-muted)] font-mono truncate mb-2">
            {session.key}
          </div>
          <div class="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
            <span class="flex items-center gap-1">
              <Clock class="w-3 h-3" />
              {session.updatedAt ? formatTimestamp(session.updatedAt, { relative: true }) : "—"}
            </span>
            <span class="flex items-center gap-1">
              <Hash class="w-3 h-3" />
              {formatTokenCount(session)}
            </span>
          </div>
        </div>
        <div class="flex items-center gap-1 flex-shrink-0">
          {isMultiChatMode.value && (
            <IconButton
              icon={<MessageSquare class="w-4 h-4" />}
              label={t("sessions.admin.openInChat")}
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                openInChat(session.key);
              }}
            />
          )}
          <IconButton
            icon={<Trash2 class="w-4 h-4" />}
            label={t("actions.delete")}
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              openSessionDetail(session);
              isDeleting.value = true;
            }}
            class="text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/10"
          />
        </div>
      </div>
    </button>
  );
}

/** Desktop table row for a session */
function SessionRow({ session }: { session: Session }) {
  const kind = getSessionDisplayKind(session);
  const displayName = getDisplayName(session);
  const isEditing = inlineEditKey.value === session.key;

  return (
    <tr
      class="group hover:bg-[var(--color-bg-hover)] cursor-pointer transition-colors"
      onClick={() => !isEditing && openSessionDetail(session)}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !isEditing) {
          e.preventDefault();
          openSessionDetail(session);
        }
      }}
      tabIndex={isEditing ? -1 : 0}
    >
      {/* Name & Key */}
      <td class="py-3 px-4">
        <div class="flex items-center gap-3">
          <KindIconWrapper kind={kind} />
          <div class="min-w-0 flex-1">
            {isEditing ? (
              <div
                class="flex items-center gap-2"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <Input
                  type="text"
                  value={inlineEditValue.value}
                  onInput={(e) => (inlineEditValue.value = (e.target as HTMLInputElement).value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveInlineEdit();
                    if (e.key === "Escape") cancelInlineEdit();
                  }}
                  onBlur={saveInlineEdit}
                  placeholder={t("sessions.admin.labelPlaceholder")}
                  class="h-8 text-sm"
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                />
              </div>
            ) : (
              <div class="flex items-center gap-2 group/label">
                <div class="font-medium truncate" title={displayName}>
                  {displayName}
                </div>
                <IconButton
                  icon={<Pencil class="w-3 h-3" />}
                  label={t("sessions.admin.editLabel")}
                  size="sm"
                  variant="ghost"
                  onClick={(e) => startInlineEdit(session, e)}
                  class="opacity-0 group-hover/label:opacity-100 !p-1 flex-shrink-0"
                />
              </div>
            )}
            <div
              class="text-xs text-[var(--color-text-muted)] font-mono truncate"
              title={session.key}
            >
              {session.key}
            </div>
          </div>
        </div>
      </td>

      {/* Model */}
      <td class="py-3 px-4">
        <div class="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
          <Cpu class="w-3.5 h-3.5 flex-shrink-0" />
          <span class="truncate max-w-[120px]" title={session.model || "Default"}>
            {session.model ? session.model.split("/").pop() : "Default"}
          </span>
        </div>
      </td>

      {/* Last Active */}
      <td class="py-3 px-4 whitespace-nowrap">
        <div class="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
          <Clock class="w-3.5 h-3.5 flex-shrink-0" />
          <span>{session.updatedAt ? formatTimestamp(session.updatedAt) : "—"}</span>
        </div>
      </td>

      {/* Tokens - hidden until lg */}
      <td class="py-3 px-4 whitespace-nowrap hidden lg:table-cell">
        <div class="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
          <Hash class="w-3.5 h-3.5 flex-shrink-0" />
          <span>{formatTokenCount(session)}</span>
          <span class="text-xs opacity-60">({formatContextUsage(session)})</span>
        </div>
      </td>

      {/* Actions */}
      <td class="py-3 px-4">
        <div class="flex items-center gap-1">
          {isMultiChatMode.value && (
            <IconButton
              icon={<MessageSquare class="w-4 h-4" />}
              label={t("sessions.admin.openInChat")}
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                openInChat(session.key);
              }}
            />
          )}
          <IconButton
            icon={<Trash2 class="w-4 h-4" />}
            label={t("actions.delete")}
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              openSessionDetail(session);
              isDeleting.value = true;
            }}
            class="text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/10"
          />
        </div>
      </td>
    </tr>
  );
}

function SessionDetailModal() {
  const session = selectedSession.value;
  if (!session) return null;

  const kind = getSessionDisplayKind(session);
  const style = getKindStyle(kind);

  return (
    <Modal
      open={!!session}
      onClose={closeSessionDetail}
      title={session.label || session.displayName || t("sessions.admin.sessionDetails")}
      size="xl"
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
                <Button
                  size="sm"
                  variant="danger"
                  icon={<Trash2 class="w-4 h-4" />}
                  onClick={deleteSession}
                >
                  {t("actions.delete")}
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                icon={<Trash2 class="w-4 h-4" />}
                onClick={() => (isDeleting.value = true)}
                class="text-[var(--color-error)] hover:bg-[var(--color-error)]/10"
              >
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
        <div class="flex items-start gap-4 p-4 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
          <KindIconWrapper kind={kind} size="md" />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <Badge variant={style.badgeVariant} size="sm">
                {getKindLabel(kind)}
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
        <div class="grid grid-cols-3 gap-2 sm:gap-4">
          <div class="text-center p-2 sm:p-4 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
            <div class="text-lg sm:text-xl font-bold">{formatTokenCount(session)}</div>
            <div class="text-xs sm:text-sm text-[var(--color-text-muted)]">
              {t("sessions.admin.tokens")}
            </div>
          </div>
          <div class="text-center p-2 sm:p-4 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
            <div class="text-lg sm:text-xl font-bold">{formatContextUsage(session)}</div>
            <div class="text-xs sm:text-sm text-[var(--color-text-muted)]">
              {t("sessions.admin.contextUsed")}
            </div>
          </div>
          <div class="text-center p-2 sm:p-4 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
            <div class="text-lg sm:text-xl font-bold">
              {session.updatedAt ? formatTimestamp(session.updatedAt, { relative: true }) : "—"}
            </div>
            <div class="text-xs sm:text-sm text-[var(--color-text-muted)]">
              {t("sessions.admin.lastActive")}
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <div class="space-y-5">
          <FormField label={t("sessions.admin.label")} hint={t("sessions.admin.labelHelp")}>
            <Input
              value={editLabel.value}
              onInput={(e) => (editLabel.value = (e.target as HTMLInputElement).value)}
              placeholder={t("sessions.admin.labelPlaceholder")}
              fullWidth
            />
          </FormField>

          <FormField label={t("sessions.admin.overrides")}>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label={t("sessions.admin.thinking")}>
                <Dropdown
                  value={editThinking.value}
                  onChange={(val) => (editThinking.value = val)}
                  options={LEVEL_OPTIONS}
                />
              </FormField>
              <FormField label={t("sessions.admin.verbose")}>
                <Dropdown
                  value={editVerbose.value}
                  onChange={(val) => (editVerbose.value = val)}
                  options={LEVEL_OPTIONS}
                />
              </FormField>
              <FormField label={t("sessions.admin.reasoning")}>
                <Dropdown
                  value={editReasoning.value}
                  onChange={(val) => (editReasoning.value = val)}
                  options={LEVEL_OPTIONS}
                />
              </FormField>
            </div>
          </FormField>
        </div>

        {/* Open in Chat (multi-chat mode only) */}
        {isMultiChatMode.value && (
          <Button
            variant="secondary"
            fullWidth
            icon={<MessageSquare class="w-4 h-4" />}
            onClick={() => {
              closeSessionDetail();
              openInChat(session.key);
            }}
          >
            {t("sessions.admin.openInChat")}
          </Button>
        )}
      </div>
    </Modal>
  );
}

// ============================================
// Main View
// ============================================

export function SessionsAdminView(_props: RouteProps) {
  useEffect(() => {
    if (isConnected.value) {
      loadAdminSessions();
    }
  }, [isConnected.value]);

  const counts = sessionCounts.value;

  return (
    <ViewErrorBoundary viewName={t("nav.sessions")}>
      <div class="flex-1 overflow-y-auto p-4 sm:p-6">
        <div class="max-w-5xl mx-auto space-y-4 sm:space-y-6">
          <PageHeader
            title={t("sessions.admin.title")}
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
                  onClick={loadAdminSessions}
                  disabled={isLoading.value || !isConnected.value}
                  variant="ghost"
                />
              </>
            }
          />

          {/* Mobile Search */}
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

          {/* Stats Cards - scrollable on mobile */}
          {isConnected.value && !isLoading.value && (
            <div class="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-5 sm:gap-3 sm:overflow-visible">
              <StatCard
                icon={MessageSquare}
                label={t("sessions.admin.stats.total")}
                value={counts.total}
                active={kindFilter.value === "all"}
                onClick={() => (kindFilter.value = "all")}
                class="flex-shrink-0 w-24 sm:w-auto"
              />
              <StatCard
                icon={getKindStyle("main").icon}
                label={t("sessions.admin.kinds.main")}
                value={counts.main}
                active={kindFilter.value === "main"}
                onClick={() => (kindFilter.value = "main")}
                class="flex-shrink-0 w-24 sm:w-auto"
              />
              <StatCard
                icon={getKindStyle("channel").icon}
                label={t("sessions.admin.kinds.channel")}
                value={counts.channel}
                active={kindFilter.value === "channel"}
                onClick={() => (kindFilter.value = "channel")}
                class="flex-shrink-0 w-24 sm:w-auto"
              />
              <StatCard
                icon={getKindStyle("cron").icon}
                label={t("sessions.admin.kinds.cron")}
                value={counts.cron}
                active={kindFilter.value === "cron"}
                onClick={() => (kindFilter.value = "cron")}
                class="flex-shrink-0 w-24 sm:w-auto"
              />
              <StatCard
                icon={getKindStyle("isolated").icon}
                label={t("sessions.admin.kinds.isolated")}
                value={counts.isolated}
                active={kindFilter.value === "isolated"}
                onClick={() => (kindFilter.value = "isolated")}
                class="flex-shrink-0 w-24 sm:w-auto"
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

          {/* Sessions - Cards on mobile, Table on desktop */}
          {isConnected.value && !isLoading.value && filteredSessions.value.length > 0 && (
            <>
              {/* Mobile: Card list */}
              <div class="md:hidden space-y-2">
                {filteredSessions.value.map((session) => (
                  <SessionCard key={session.key} session={session} />
                ))}
              </div>

              {/* Desktop: Table */}
              <Card padding="none" class="hidden md:block">
                <table class="w-full">
                  <thead>
                    <tr class="border-b border-[var(--color-border)] text-left text-sm text-[var(--color-text-muted)]">
                      <th class="py-3 px-4 font-medium">{t("sessions.admin.columns.session")}</th>
                      <th class="py-3 px-4 font-medium w-32">
                        {t("sessions.admin.columns.model")}
                      </th>
                      <th class="py-3 px-4 font-medium w-36">
                        {t("sessions.admin.columns.lastActive")}
                      </th>
                      <th class="py-3 px-4 font-medium w-32 hidden lg:table-cell">
                        {t("sessions.admin.columns.tokens")}
                      </th>
                      <th class="py-3 px-4 font-medium w-12"></th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-[var(--color-border)]">
                    {filteredSessions.value.map((session) => (
                      <SessionRow key={session.key} session={session} />
                    ))}
                  </tbody>
                </table>
              </Card>
            </>
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
                  <p class="text-[var(--color-text-muted)]">
                    {t("sessions.admin.emptyDescription")}
                  </p>
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

        <SessionDetailModal />
      </div>
    </ViewErrorBoundary>
  );
}
