/**
 * SessionDeleteModal
 *
 * Confirmation modal for deleting a session.
 */

import { useState } from "preact/hooks";
import type { Session } from "@/types/sessions";
import { t } from "@/lib/i18n";
import { Modal, Button } from "@/components/ui";
import { getSessionLabel } from "./SessionItem";

interface SessionDeleteModalProps {
  session: Session | null;
  onClose: () => void;
  onDelete: (session: Session) => void;
}

export function SessionDeleteModal({ session, onClose, onDelete }: SessionDeleteModalProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!session) return;

    setDeleting(true);
    try {
      await onDelete(session);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  if (!session) return null;

  return (
    <Modal open={!!session} onClose={onClose} title={t("sessions.delete")}>
      <p class="text-sm text-[var(--color-text-secondary)] mb-4">
        {t("sessions.deleteConfirm", { name: getSessionLabel(session) })}
      </p>

      <p class="text-xs text-[var(--color-text-muted)] mb-4">{t("sessions.deleteWarning")}</p>

      <div class="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={deleting}>
          {t("actions.cancel")}
        </Button>
        <Button variant="danger" onClick={handleDelete} loading={deleting}>
          {t("actions.delete")}
        </Button>
      </div>
    </Modal>
  );
}
