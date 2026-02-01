/**
 * NewChatModal
 *
 * Modal dialog for creating a new chat with agent selection.
 * Shown when "New Chat" is clicked and useDefaults is false.
 */

import { useState } from "preact/hooks";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { Checkbox } from "@/components/ui/Checkbox";
import { t } from "@/lib/i18n";
import { agentOptions, defaultAgentId } from "@/signals/agents";
import { newChatSettings } from "@/signals/settings";

interface NewChatModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (agentId: string) => void;
}

export function NewChatModal({ open, onClose, onCreate }: NewChatModalProps) {
  // Local state for form
  const [selectedAgent, setSelectedAgent] = useState(
    newChatSettings.value.defaultAgentId || defaultAgentId.value,
  );
  const [rememberChoice, setRememberChoice] = useState(false);

  const handleCreate = () => {
    // Update settings if "remember" is checked
    if (rememberChoice) {
      newChatSettings.value = {
        ...newChatSettings.value,
        defaultAgentId: selectedAgent,
        useDefaults: true, // Enable defaults so next time skips modal
      };
    }

    onCreate(selectedAgent);
    onClose();
  };

  const handleClose = () => {
    // Reset local state when closing
    setSelectedAgent(newChatSettings.value.defaultAgentId || defaultAgentId.value);
    setRememberChoice(false);
    onClose();
  };

  // Don't render if no agents loaded
  if (agentOptions.value.length === 0) {
    return null;
  }

  return (
    <Modal open={open} onClose={handleClose} title={t("newChatModal.title")}>
      <div class="space-y-6">
        {/* Agent Selection */}
        <div>
          <label class="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            {t("newChatModal.agent")}
          </label>
          <Dropdown
            value={selectedAgent}
            onChange={setSelectedAgent}
            options={agentOptions.value}
            class="w-full"
          />
          <p class="mt-1.5 text-xs text-[var(--color-text-muted)]">
            {t("newChatModal.agentDescription")}
          </p>
        </div>

        {/* Remember Choice */}
        <Checkbox
          checked={rememberChoice}
          onChange={setRememberChoice}
          label={t("newChatModal.rememberChoice")}
          description={t("newChatModal.rememberChoiceDescription")}
        />

        {/* Actions */}
        <div class="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={handleClose}>
            {t("actions.cancel")}
          </Button>
          <Button variant="primary" onClick={handleCreate}>
            {t("newChatModal.create")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
