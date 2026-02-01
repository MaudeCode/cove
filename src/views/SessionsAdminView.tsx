/**
 * SessionsAdminView
 *
 * Admin view for managing all sessions with filters, inline editing,
 * and per-session configuration overrides.
 * Route: /sessions
 */

import { signal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { t, formatRelativeTime } from "@/lib/i18n";
import { send } from "@/lib/gateway";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Spinner } from "@/components/ui/Spinner";
import { RefreshCw } from "lucide-preact";
import type { Session } from "@/types/sessions";
import type { RouteProps } from "@/types/routes";

// ============================================
// Local State
// ============================================

/** Filter: active within N minutes (empty = no filter) */
const activeMinutes = signal<string>("");

/** Filter: limit number of results */
const limit = signal<string>("120");

/** Filter: include global sessions */
const includeGlobal = signal<boolean>(true);

/** Filter: include unknown sessions */
const includeUnknown = signal<boolean>(false);

/** Sessions list */
const adminSessions = signal<Session[]>([]);

/** Loading state */
const isLoading = signal<boolean>(false);

/** Error state */
const error = signal<string | null>(null);

/** Session being deleted (for confirmation) */
const deletingKey = signal<string | null>(null);

// ============================================
// Helpers
// ============================================

/** Format token count as "used / total" */
function formatTokens(session: Session): string {
  const used = session.totalTokens ?? 0;
  const total = session.contextTokens ?? 200000;
  return `${used.toLocaleString()} / ${total.toLocaleString()}`;
}

/** Get session kind display */
function getKindDisplay(session: Session): string {
  if (session.kind === "channel" || session.channel) return "channel";
  if (session.kind === "group") return "group";
  return "direct";
}

/** Determine session key display style */
function getKeyStyle(session: Session): string {
  // Cron sessions in orange/warning
  if (session.key.includes(":cron:")) {
    return "text-[var(--color-warning)]";
  }
  // Channel sessions in accent
  if (session.channel || session.key.includes("discord:") || session.key.includes("telegram:")) {
    return "text-[var(--color-accent)]";
  }
  // Default
  return "text-[var(--color-error)]";
}

// ============================================
// Actions
// ============================================

async function loadAdminSessions(): Promise<void> {
  isLoading.value = true;
  error.value = null;

  try {
    const params: Record<string, unknown> = {
      limit: limit.value ? parseInt(limit.value, 10) : 120,
    };

    if (activeMinutes.value) {
      params.activeMinutes = parseInt(activeMinutes.value, 10);
    }

    // Note: includeGlobal and includeUnknown would need backend support
    // For now we filter client-side or pass if API supports

    const result = await send<{ sessions: Session[] }>("sessions.list", params);
    adminSessions.value = result.sessions ?? [];
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    isLoading.value = false;
  }
}

async function patchSession(
  sessionKey: string,
  updates: { label?: string; thinking?: string; verbose?: string; reasoning?: string },
): Promise<void> {
  try {
    await send("sessions.patch", {
      key: sessionKey,
      ...updates,
    });

    // Update local state
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

/** Dropdown for level settings (thinking, verbose, reasoning) */
function LevelDropdown({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value ?? "inherit"}
      onChange={(e) => onChange((e.target as HTMLSelectElement).value)}
      class="px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] cursor-pointer"
    >
      <option value="inherit">inherit</option>
      <option value="off">off</option>
      <option value="low">low</option>
      <option value="medium">medium</option>
      <option value="high">high</option>
    </select>
  );
}

/** Session row component */
function SessionRow({ session }: { session: Session }) {
  const isDeleting = deletingKey.value === session.key;

  return (
    <tr class="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]">
      {/* Key */}
      <td class="py-3 px-2">
        <span class={`text-sm font-mono break-all ${getKeyStyle(session)}`}>
          {session.displayName || session.label || session.key}
        </span>
      </td>

      {/* Label (editable) */}
      <td class="py-3 px-2">
        <input
          type="text"
          value={session.label ?? ""}
          placeholder={t("sessions.admin.labelPlaceholder")}
          onBlur={(e) => {
            const newLabel = (e.target as HTMLInputElement).value;
            if (newLabel !== (session.label ?? "")) {
              patchSession(session.key, { label: newLabel || undefined });
            }
          }}
          class="w-full px-2 py-1 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] placeholder:text-[var(--color-text-muted)]"
        />
      </td>

      {/* Kind */}
      <td class="py-3 px-2 text-sm text-[var(--color-text-muted)]">{getKindDisplay(session)}</td>

      {/* Updated */}
      <td class="py-3 px-2 text-sm text-[var(--color-text-muted)] whitespace-nowrap">
        {session.updatedAt ? formatRelativeTime(new Date(session.updatedAt)) : "—"}
      </td>

      {/* Tokens */}
      <td class="py-3 px-2 text-sm text-[var(--color-text-muted)] whitespace-nowrap">
        {formatTokens(session)}
      </td>

      {/* Thinking */}
      <td class="py-3 px-2">
        <LevelDropdown
          value={(session as Record<string, unknown>).thinking as string | undefined}
          onChange={(val) => patchSession(session.key, { thinking: val })}
        />
      </td>

      {/* Verbose */}
      <td class="py-3 px-2">
        <LevelDropdown
          value={(session as Record<string, unknown>).verbose as string | undefined}
          onChange={(val) => patchSession(session.key, { verbose: val })}
        />
      </td>

      {/* Reasoning */}
      <td class="py-3 px-2">
        <LevelDropdown
          value={(session as Record<string, unknown>).reasoning as string | undefined}
          onChange={(val) => patchSession(session.key, { reasoning: val })}
        />
      </td>

      {/* Actions */}
      <td class="py-3 px-2">
        {isDeleting ? (
          <div class="flex items-center gap-2">
            <Button size="sm" variant="danger" onClick={() => deleteSession(session.key)}>
              {t("actions.confirm")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => (deletingKey.value = null)}>
              {t("actions.cancel")}
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="danger"
            onClick={() => (deletingKey.value = session.key)}
            class="opacity-70 hover:opacity-100"
          >
            {t("actions.delete")}
          </Button>
        )}
      </td>
    </tr>
  );
}

// ============================================
// Main View
// ============================================

export function SessionsAdminView(_props: RouteProps) {
  // Load sessions on mount
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
        <div class="flex flex-wrap items-end gap-4 p-4 rounded-xl bg-[var(--color-bg-secondary)]">
          <div class="flex flex-col gap-1">
            <label class="text-xs text-[var(--color-text-muted)]">
              {t("sessions.admin.activeWithin")}
            </label>
            <Input
              type="number"
              value={activeMinutes.value}
              onInput={(e) => (activeMinutes.value = (e.target as HTMLInputElement).value)}
              placeholder={t("sessions.admin.minutes")}
              class="w-32"
            />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-xs text-[var(--color-text-muted)]">
              {t("sessions.admin.limit")}
            </label>
            <Input
              type="number"
              value={limit.value}
              onInput={(e) => (limit.value = (e.target as HTMLInputElement).value)}
              class="w-24"
            />
          </div>

          <Checkbox
            checked={includeGlobal.value}
            onChange={(checked) => (includeGlobal.value = checked)}
            label={t("sessions.admin.includeGlobal")}
          />

          <Checkbox
            checked={includeUnknown.value}
            onChange={(checked) => (includeUnknown.value = checked)}
            label={t("sessions.admin.includeUnknown")}
          />
        </div>

        {/* Error */}
        {error.value && (
          <div class="p-4 rounded-xl bg-[var(--color-error)]/10 text-[var(--color-error)]">
            {error.value}
          </div>
        )}

        {/* Loading */}
        {isLoading.value && (
          <div class="flex justify-center py-8">
            <Spinner size="lg" />
          </div>
        )}

        {/* Sessions table */}
        {!isLoading.value && adminSessions.value.length > 0 && (
          <div class="overflow-x-auto rounded-xl border border-[var(--color-border)]">
            <table class="w-full">
              <thead class="bg-[var(--color-bg-secondary)]">
                <tr class="text-left text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                  <th class="py-3 px-2 font-medium">{t("sessions.admin.key")}</th>
                  <th class="py-3 px-2 font-medium">{t("sessions.admin.label")}</th>
                  <th class="py-3 px-2 font-medium">{t("sessions.admin.kind")}</th>
                  <th class="py-3 px-2 font-medium">{t("sessions.admin.updated")}</th>
                  <th class="py-3 px-2 font-medium">{t("sessions.admin.tokens")}</th>
                  <th class="py-3 px-2 font-medium">{t("sessions.admin.thinking")}</th>
                  <th class="py-3 px-2 font-medium">{t("sessions.admin.verbose")}</th>
                  <th class="py-3 px-2 font-medium">{t("sessions.admin.reasoning")}</th>
                  <th class="py-3 px-2 font-medium">{t("sessions.admin.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {adminSessions.value.map((session) => (
                  <SessionRow key={session.key} session={session} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty state */}
        {!isLoading.value && adminSessions.value.length === 0 && !error.value && (
          <div class="text-center py-12 text-[var(--color-text-muted)]">
            {t("sessions.admin.empty")}
          </div>
        )}

        {/* Session count */}
        {!isLoading.value && adminSessions.value.length > 0 && (
          <p class="text-sm text-[var(--color-text-muted)]">
            {t("sessions.admin.count", { count: adminSessions.value.length })}
          </p>
        )}
      </div>
    </div>
  );
}
