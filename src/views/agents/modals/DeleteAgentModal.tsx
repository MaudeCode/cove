/**
 * DeleteAgentModal
 *
 * Modal for deleting an agent with confirmation.
 */

import { t } from "@/lib/i18n";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { AlertTriangle } from "lucide-preact";
import {
  selectedAgent,
  workspacePath,
  deleteModalOpen,
  deleteConfirmText,
  deleteIncludeFiles,
  deleteDeleting,
  deleteAgent,
} from "../agent-state";

export function DeleteAgentModal() {
  const agent = selectedAgent.value;

  return (
    <Modal
      open={deleteModalOpen.value}
      onClose={() => (deleteModalOpen.value = false)}
      title={t("common.deleteAgent")}
    >
      <div class="space-y-4">
        {/* Warning banner */}
        <div class="p-4 rounded-xl bg-[var(--color-error)]/10 border border-[var(--color-error)]/20">
          <div class="flex items-start gap-3">
            <AlertTriangle class="w-6 h-6 text-[var(--color-error)] flex-shrink-0 mt-0.5" />
            <div>
              <h4 class="font-semibold text-[var(--color-error)]">{t("agents.delete.warning")}</h4>
              <p class="mt-1 text-sm text-[var(--color-text-secondary)]">
                {t("agents.delete.warningDescription")}
              </p>
            </div>
          </div>
        </div>

        {/* What will be deleted */}
        <div class="text-sm">
          <p class="font-medium mb-2">{t("agents.delete.willDelete")}</p>
          <ul class="list-disc list-inside space-y-1 text-[var(--color-text-secondary)]">
            <li>{t("agents.delete.willDeleteConfig")}</li>
            <li>{t("agents.delete.willDeleteBindings")}</li>
            <li>{t("agents.delete.willDeleteSessions")}</li>
          </ul>
        </div>

        {/* Delete files option */}
        <div class="p-3 rounded-lg border border-[var(--color-border)]">
          <Checkbox
            checked={deleteIncludeFiles.value}
            onChange={(checked) => (deleteIncludeFiles.value = checked)}
            label={t("agents.delete.includeFiles")}
            description={t("agents.delete.includeFilesDescription", { path: workspacePath.value })}
            class="text-[var(--color-error)]"
          />
        </div>

        {/* Confirmation input */}
        <div>
          <label htmlFor="delete-confirm" class="text-sm font-medium">
            {t("agents.delete.confirmPrompt", { id: agent?.id || "agent" })}
          </label>
          <Input
            id="delete-confirm"
            type="text"
            value={deleteConfirmText.value}
            onInput={(e) => (deleteConfirmText.value = (e.target as HTMLInputElement).value)}
            placeholder={agent?.id || "agent"}
            class="mt-1 font-mono"
            fullWidth
          />
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={() => (deleteModalOpen.value = false)}
            disabled={deleteDeleting.value}
          >
            {t("actions.cancel")}
          </Button>
          <Button
            variant="danger"
            onClick={deleteAgent}
            disabled={deleteDeleting.value || deleteConfirmText.value !== agent?.id}
          >
            {deleteDeleting.value ? t("actions.deleting") : t("common.deleteAgent")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
