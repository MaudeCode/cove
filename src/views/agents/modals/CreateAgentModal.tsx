/**
 * CreateAgentModal
 *
 * Modal for creating a new agent.
 */

import { t } from "@/lib/i18n";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  createModalOpen,
  createName,
  createWorkspace,
  createEmoji,
  createSaving,
  createAgent,
} from "../agent-state";

export function CreateAgentModal() {
  return (
    <Modal
      open={createModalOpen.value}
      onClose={() => (createModalOpen.value = false)}
      title={t("common.createAgent")}
    >
      <div class="space-y-4">
        <div>
          <label htmlFor="create-name" class="text-sm font-medium">
            {t("common.name")}
          </label>
          <Input
            id="create-name"
            type="text"
            value={createName.value}
            onInput={(e) => (createName.value = (e.target as HTMLInputElement).value)}
            placeholder={t("agents.create.namePlaceholder")}
            class="mt-1"
            fullWidth
          />
          <p class="mt-1 text-xs text-[var(--color-text-muted)]">{t("agents.create.nameHint")}</p>
        </div>
        <div>
          <label htmlFor="create-workspace" class="text-sm font-medium">
            {t("common.workspace")}
          </label>
          <Input
            id="create-workspace"
            type="text"
            value={createWorkspace.value}
            onInput={(e) => (createWorkspace.value = (e.target as HTMLInputElement).value)}
            placeholder={t("agents.create.workspacePlaceholder")}
            class="mt-1 font-mono text-sm"
            fullWidth
          />
        </div>
        <div>
          <label htmlFor="create-emoji" class="text-sm font-medium">
            {t("agents.create.emoji")}
          </label>
          <Input
            id="create-emoji"
            type="text"
            value={createEmoji.value}
            onInput={(e) => (createEmoji.value = (e.target as HTMLInputElement).value)}
            placeholder={t("agents.create.emojiPlaceholder")}
            class="mt-1"
            fullWidth
          />
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={() => (createModalOpen.value = false)}
            disabled={createSaving.value}
          >
            {t("actions.cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={createAgent}
            disabled={
              createSaving.value || !createName.value.trim() || !createWorkspace.value.trim()
            }
          >
            {createSaving.value ? t("actions.creating") : t("common.createAgent")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
