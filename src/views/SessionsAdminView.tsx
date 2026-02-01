/**
 * SessionsAdminView
 *
 * Admin view for managing all sessions with filters, inline editing,
 * and per-session configuration overrides.
 * Route: /sessions
 */

import { signal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { t, formatTimestamp } from "@/lib/i18n";
import { send } from "@/lib/gateway";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { Spinner } from "@/components/ui/Spinner";
import { Dropdown } from "@/components/ui/Dropdown";
import {
  RefreshCw,
  Trash2,
  MessageSquare,
  Clock,
  Cpu,
  Hash,
  Users,
  Radio,
  Calendar,
} from "lucide-preact";
import type { Session } from "@/types/sessions";
import type { RouteProps } from "@/types/routes";

// ============================================
// Local State
// ============================================

const activeMinutes = signal<string>("");
const limit = signal<string>("100");
const includeGlobal = signal<boolean>(true);
const includeUnknown = signal<boolean>(false);
const adminSessions = signal<Session[]>([]);
const isLoading = signal<boolean>(false);
const error = signal<string | null>(null);
const deletingKey = signal<string | null>(null);

// ============================================
// Helpers
// ============================================

function formatTokens(session: Session): string {
  const used = session.totalTokens ?? 0;
  const total = session.contextTokens ?? 200000;
  const percent = total > 0 ? Math.round((used / total) * 100) : 0;
  return `${used.toLocaleString()} / ${total.toLocaleString()} (${percent}%)`;
}

function getSessionIcon(session: Session) {
  if (session.key.includes(":cron:")) return Calendar;
  if (session.channel === "discord" || session.key.includes("discord:")) return Users;
  if (session.channel || session.kind === "channel") return Radio;
  return MessageSquare;
}

function getSessionBadgeVariant(
  session: Session,
): "default" | "success" | "warning" | "error" | "info" {
  if (session.key.includes(":cron:")) return "warning";
  if (session.channel || session.kind === "channel") return "info";
  if (session.kind === "main") return "success";
  return "default";
}

function getSessionKind(session: Session): string {
  if (session.key.includes(":cron:")) return "Cron";
  if (session.kind === "channel" || session.channel) return "Channel";
  if (session.kind === "group") return "Group";
  if (session.kind === "main") return "Main";
  if (session.kind === "isolated") return "Isolated";
  return "Direct";
}

// ============================================
// Actions
// ============================================

async function loadAdminSessions(): Promise<void> {
  isLoading.value = true;
  error.value = null;

  try {
    const params: Record<string, unknown> = {
      limit: limit.value ? parseInt(limit.value, 10) : 100,
    };

    if (activeMinutes.value) {
      params.activeMinutes = parseInt(activeMinutes.value, 10);
    }

    const result = await send<{ sessions: Session[] }>("sessions.list", params);
    adminSessions.value = result.sessions ?? [];
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    isLoading.value = false;
  }
}

async function patchSession(sessionKey: string, updates: Record<string, unknown>): Promise<void> {
  try {
    await send("sessions.patch", { key: sessionKey, ...updates });
    adminSessions.value = adminSessions.value.map((s) =>
      s.key === sessionKey ? { ...s, ...updates } : s,
    );
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  }
}

async function deleteSession(sessionKey: string): Promise<void> {
  try {
    await send("sessions.delete", { key: sessionKey });
    adminSessions.value = adminSessions.value.filter((s) => s.key !== sessionKey);
    deletingKey.value = null;
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  }
}

// ============================================
// Components
// ============================================

const LEVEL_OPTIONS = [
  { value: "inherit", label: "Inherit" },
  { value: "off", label: "Off" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

function SessionCard({ session }: { session: Session }) {
  const Icon = getSessionIcon(session);
  const isDeleting = deletingKey.value === session.key;
  const displayName = session.label || session.displayName || session.key;

  return (
    <Card class="overflow-hidden">
      <div class="p-4">
        {/* Header */}
        <div class="flex items-start justify-between gap-4 mb-4">
          <div class="flex items-center gap-3 min-w-0">
            <div
              class={`p-2 rounded-lg flex-shrink-0 ${
                session.key.includes(":cron:")
                  ? "bg-[var(--color-warning)]/10"
                  : session.channel
                    ? "bg-[var(--color-info)]/10"
                    : "bg-[var(--color-accent)]/10"
              }`}
            >
              <Icon
                class={`w-5 h-5 ${
                  session.key.includes(":cron:")
                    ? "text-[var(--color-warning)]"
                    : session.channel
                      ? "text-[var(--color-info)]"
                      : "text-[var(--color-accent)]"
                }`}
              />
            </div>
            <div class="min-w-0">
              <h3 class="font-medium truncate" title={displayName}>
                {displayName}
              </h3>
              <p
                class="text-xs text-[var(--color-text-muted)] font-mono truncate"
                title={session.key}
              >
                {session.key}
              </p>
            </div>
          </div>
          <Badge variant={getSessionBadgeVariant(session)} size="sm">
            {getSessionKind(session)}
          </Badge>
        </div>

        {/* Label input */}
        <div class="mb-4">
          <label class="text-xs text-[var(--color-text-muted)] mb-1 block">
            {t("sessions.admin.label")}
          </label>
          <Input
            value={session.label ?? ""}
            placeholder={t("sessions.admin.labelPlaceholder")}
            onBlur={(e) => {
              const newLabel = (e.target as HTMLInputElement).value;
              if (newLabel !== (session.label ?? "")) {
                patchSession(session.key, { label: newLabel || undefined });
              }
            }}
          />
        </div>

        {/* Stats row */}
        <div class="flex flex-wrap gap-4 text-sm text-[var(--color-text-muted)] mb-4">
          <div class="flex items-center gap-1.5">
            <Clock class="w-4 h-4" />
            <span>{session.updatedAt ? formatTimestamp(session.updatedAt) : "—"}</span>
          </div>
          <div class="flex items-center gap-1.5">
            <Hash class="w-4 h-4" />
            <span>{formatTokens(session)}</span>
          </div>
          {session.model && (
            <div class="flex items-center gap-1.5">
              <Cpu class="w-4 h-4" />
              <span class="truncate max-w-[150px]">{session.model}</span>
            </div>
          )}
        </div>

        {/* Level dropdowns */}
        <div class="grid grid-cols-3 gap-3 mb-4">
          <div>
            <label class="text-xs text-[var(--color-text-muted)] mb-1 block">
              {t("sessions.admin.thinking")}
            </label>
            <Dropdown
              value={((session as Record<string, unknown>).thinking as string) ?? "inherit"}
              onChange={(val) => patchSession(session.key, { thinking: val })}
              options={LEVEL_OPTIONS}
            />
          </div>
          <div>
            <label class="text-xs text-[var(--color-text-muted)] mb-1 block">
              {t("sessions.admin.verbose")}
            </label>
            <Dropdown
              value={((session as Record<string, unknown>).verbose as string) ?? "inherit"}
              onChange={(val) => patchSession(session.key, { verbose: val })}
              options={LEVEL_OPTIONS}
            />
          </div>
          <div>
            <label class="text-xs text-[var(--color-text-muted)] mb-1 block">
              {t("sessions.admin.reasoning")}
            </label>
            <Dropdown
              value={((session as Record<string, unknown>).reasoning as string) ?? "inherit"}
              onChange={(val) => patchSession(session.key, { reasoning: val })}
              options={LEVEL_OPTIONS}
            />
          </div>
        </div>

        {/* Actions */}
        <div class="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
          {isDeleting ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => (deletingKey.value = null)}>
                {t("actions.cancel")}
              </Button>
              <Button size="sm" variant="danger" onClick={() => deleteSession(session.key)}>
                {t("actions.confirm")}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => (deletingKey.value = session.key)}
              class="text-[var(--color-error)] hover:bg-[var(--color-error)]/10"
            >
              <Trash2 class="w-4 h-4 mr-1.5" />
              {t("actions.delete")}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// ============================================
// Main View
// ============================================

export function SessionsAdminView(_props: RouteProps) {
  useEffect(() => {
    loadAdminSessions();
  }, []);

  return (
    <div class="flex-1 overflow-y-auto p-6">
      <div class="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div class="flex items-start justify-between">
          <div>
            <h1 class="text-2xl font-bold">{t("sessions.admin.title")}</h1>
            <p class="text-[var(--color-text-muted)] mt-1">{t("sessions.admin.description")}</p>
          </div>
          <Button onClick={loadAdminSessions} disabled={isLoading.value}>
            <RefreshCw class={`w-4 h-4 mr-2 ${isLoading.value ? "animate-spin" : ""}`} />
            {t("actions.refresh")}
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <div class="p-4">
            <div class="flex flex-wrap items-end gap-6">
              <div class="flex-1 min-w-[150px] max-w-[200px]">
                <label class="text-sm text-[var(--color-text-muted)] mb-1.5 block">
                  {t("sessions.admin.activeWithin")}
                </label>
                <Input
                  type="number"
                  value={activeMinutes.value}
                  onInput={(e) => (activeMinutes.value = (e.target as HTMLInputElement).value)}
                  placeholder={t("sessions.admin.minutes")}
                />
              </div>

              <div class="w-24">
                <label class="text-sm text-[var(--color-text-muted)] mb-1.5 block">
                  {t("sessions.admin.limit")}
                </label>
                <Input
                  type="number"
                  value={limit.value}
                  onInput={(e) => (limit.value = (e.target as HTMLInputElement).value)}
                />
              </div>

              <Toggle
                checked={includeGlobal.value}
                onChange={(checked) => (includeGlobal.value = checked)}
                label={t("sessions.admin.includeGlobal")}
              />

              <Toggle
                checked={includeUnknown.value}
                onChange={(checked) => (includeUnknown.value = checked)}
                label={t("sessions.admin.includeUnknown")}
              />
            </div>
          </div>
        </Card>

        {/* Error */}
        {error.value && (
          <div class="p-4 rounded-xl bg-[var(--color-error)]/10 text-[var(--color-error)]">
            {error.value}
          </div>
        )}

        {/* Loading */}
        {isLoading.value && (
          <div class="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        )}

        {/* Session cards grid */}
        {!isLoading.value && adminSessions.value.length > 0 && (
          <>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              {adminSessions.value.map((session) => (
                <SessionCard key={session.key} session={session} />
              ))}
            </div>
            <p class="text-sm text-[var(--color-text-muted)] text-center">
              {t("sessions.admin.count", { count: adminSessions.value.length })}
            </p>
          </>
        )}

        {/* Empty state */}
        {!isLoading.value && adminSessions.value.length === 0 && !error.value && (
          <Card>
            <div class="p-12 text-center">
              <MessageSquare class="w-12 h-12 mx-auto mb-4 text-[var(--color-text-muted)] opacity-50" />
              <p class="text-[var(--color-text-muted)]">{t("sessions.admin.empty")}</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
