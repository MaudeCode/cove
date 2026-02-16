import { t, formatTimestamp } from "@/lib/i18n";
import { isMultiChatMode } from "@/signals/settings";
import { getSessionDisplayKind, type SessionKind } from "@/lib/session-utils";
import { ListCard } from "@/components/ui/ListCard";
import { Badge } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Clock, Hash, MessageSquare, Trash2, Pencil, Cpu } from "lucide-preact";
import type { Session } from "@/types/sessions";
import {
  filteredSessions,
  inlineEditKey,
  inlineEditValue,
  getKindStyle,
  getKindLabel,
  getDisplayName,
  formatTokenCount,
  formatContextUsage,
  openSessionDetail,
  startInlineEdit,
  saveInlineEdit,
  cancelInlineEdit,
  openInChat,
  isDeleting,
} from "@/views/sessions-admin/useSessionsAdminState";

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

export function KindIconWrapper({ kind, size = "sm" }: { kind: SessionKind; size?: "sm" | "md" }) {
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

function SessionActions({ session, onDelete }: { session: Session; onDelete: (e: Event) => void }) {
  return (
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
        onClick={onDelete}
        class="text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/10"
      />
    </div>
  );
}

function SessionCard({ session }: { session: Session }) {
  const kind = getSessionDisplayKind(session);
  const style = getKindStyle(kind);
  const displayName = getDisplayName(session);

  return (
    <ListCard
      icon={style.icon}
      iconVariant={
        kind === "main"
          ? "success"
          : kind === "channel"
            ? "info"
            : kind === "cron"
              ? "warning"
              : "default"
      }
      title={displayName}
      subtitle={session.key}
      badges={
        <Badge variant={style.badgeVariant} size="sm">
          {getKindLabel(kind)}
        </Badge>
      }
      meta={[
        {
          icon: Clock,
          value: session.updatedAt ? formatTimestamp(session.updatedAt, { relative: true }) : "—",
        },
        { icon: Hash, value: formatTokenCount(session) },
      ]}
      actions={
        <SessionActions
          session={session}
          onDelete={(e) => {
            e.stopPropagation();
            openSessionDetail(session);
            isDeleting.value = true;
          }}
        />
      }
      onClick={() => openSessionDetail(session)}
    />
  );
}

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
                    if (e.key === "Enter") {
                      void saveInlineEdit();
                    }
                    if (e.key === "Escape") cancelInlineEdit();
                  }}
                  onBlur={() => {
                    void saveInlineEdit();
                  }}
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

      <td class="py-3 px-4">
        <div class="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
          <Cpu class="w-3.5 h-3.5 flex-shrink-0" />
          <span class="truncate max-w-[120px]" title={session.model || "Default"}>
            {session.model ? session.model.split("/").pop() : "Default"}
          </span>
        </div>
      </td>

      <td class="py-3 px-4 whitespace-nowrap">
        <div class="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
          <Clock class="w-3.5 h-3.5 flex-shrink-0" />
          <span>{session.updatedAt ? formatTimestamp(session.updatedAt) : "—"}</span>
        </div>
      </td>

      <td class="py-3 px-4 whitespace-nowrap hidden lg:table-cell">
        <div class="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
          <Hash class="w-3.5 h-3.5 flex-shrink-0" />
          <span>{formatTokenCount(session)}</span>
          <span class="text-xs opacity-60">({formatContextUsage(session)})</span>
        </div>
      </td>

      <td class="py-3 px-4">
        <SessionActions
          session={session}
          onDelete={(e) => {
            e.stopPropagation();
            openSessionDetail(session);
            isDeleting.value = true;
          }}
        />
      </td>
    </tr>
  );
}

export function SessionsAdminList() {
  return (
    <>
      <div class="md:hidden space-y-2">
        {filteredSessions.value.map((session) => (
          <SessionCard key={session.key} session={session} />
        ))}
      </div>

      <Card padding="none" class="hidden md:block">
        <table class="w-full">
          <thead>
            <tr class="border-b border-[var(--color-border)] text-left text-sm text-[var(--color-text-muted)]">
              <th class="py-3 px-4 font-medium">{t("common.session")}</th>
              <th class="py-3 px-4 font-medium w-32">{t("common.model")}</th>
              <th class="py-3 px-4 font-medium w-36">{t("common.lastActive")}</th>
              <th class="py-3 px-4 font-medium w-32 hidden lg:table-cell">{t("common.tokens")}</th>
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
  );
}
