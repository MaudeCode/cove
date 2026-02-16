import { t, formatTimestamp } from "@/lib/i18n";
import { isMultiChatMode } from "@/signals/settings";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Dropdown } from "@/components/ui/Dropdown";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { DeleteConfirmFooter, EditFooter } from "@/components/ui/ModalFooter";
import { MessageSquare } from "lucide-preact";
import { getSessionDisplayKind } from "@/lib/session-utils";
import { KindIconWrapper } from "@/views/sessions-admin/SessionsAdminList";
import {
  selectedSession,
  isDeleting,
  isSaving,
  editLabel,
  editThinking,
  editVerbose,
  editReasoning,
  getKindStyle,
  getKindLabel,
  formatTokenCount,
  formatContextUsage,
  closeSessionDetail,
  deleteSession,
  saveSession,
  openInChat,
} from "@/views/sessions-admin/useSessionsAdminState";

const LEVEL_OPTIONS = [
  { value: "inherit", label: t("sessions.admin.levels.inherit") },
  { value: "off", label: t("common.off") },
  { value: "low", label: t("sessions.admin.levels.low") },
  { value: "medium", label: t("common.medium") },
  { value: "high", label: t("sessions.admin.levels.high") },
];

export function SessionDetailModal() {
  const session = selectedSession.value;
  if (!session) return null;

  const kind = getSessionDisplayKind(session);
  const style = getKindStyle(kind);

  return (
    <Modal
      open={!!session}
      onClose={closeSessionDetail}
      title={session.label || session.displayName || t("common.sessionDetails")}
      size="xl"
      footer={
        isDeleting.value ? (
          <DeleteConfirmFooter
            message={t("common.deleteThisSession")}
            onCancel={() => (isDeleting.value = false)}
            onDelete={() => {
              void deleteSession();
            }}
          />
        ) : (
          <EditFooter
            isEdit
            onDeleteClick={() => (isDeleting.value = true)}
            onCancel={closeSessionDetail}
            onSave={() => {
              void saveSession();
            }}
            isSaving={isSaving.value}
          />
        )
      }
    >
      <div class="space-y-4 sm:space-y-6">
        <div class="flex items-start gap-3 p-3 sm:p-4 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
          <KindIconWrapper kind={kind} size="md" />
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
              <Badge variant={style.badgeVariant} size="sm">
                {getKindLabel(kind)}
              </Badge>
              {session.channel && (
                <Badge variant="default" size="sm">
                  {session.channel}
                </Badge>
              )}
            </div>
            <code class="text-xs sm:text-sm text-[var(--color-text-muted)] break-all">
              {session.key}
            </code>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-2 sm:gap-4">
          <div class="text-center p-2 sm:p-4 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
            <div class="text-lg sm:text-xl font-bold">{formatTokenCount(session)}</div>
            <div class="text-xs sm:text-sm text-[var(--color-text-muted)]">
              {t("common.tokens")}
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
              {t("common.lastActive")}
            </div>
          </div>
        </div>

        <div class="space-y-4 sm:space-y-5">
          <FormField label={t("sessions.admin.label")} hint={t("sessions.admin.labelHelp")}>
            <Input
              value={editLabel.value}
              onInput={(e) => (editLabel.value = (e.target as HTMLInputElement).value)}
              placeholder={t("sessions.admin.labelPlaceholder")}
              fullWidth
            />
          </FormField>

          <FormField label={t("sessions.admin.overrides")}>
            <div class="grid grid-cols-3 gap-2 sm:gap-4">
              <FormField label={t("common.thinking")} class="space-y-1">
                <Dropdown
                  value={editThinking.value}
                  onChange={(val) => (editThinking.value = val)}
                  options={LEVEL_OPTIONS}
                />
              </FormField>
              <FormField label={t("sessions.admin.verbose")} class="space-y-1">
                <Dropdown
                  value={editVerbose.value}
                  onChange={(val) => (editVerbose.value = val)}
                  options={LEVEL_OPTIONS}
                />
              </FormField>
              <FormField label={t("sessions.admin.reasoning")} class="space-y-1">
                <Dropdown
                  value={editReasoning.value}
                  onChange={(val) => (editReasoning.value = val)}
                  options={LEVEL_OPTIONS}
                />
              </FormField>
            </div>
          </FormField>
        </div>

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
