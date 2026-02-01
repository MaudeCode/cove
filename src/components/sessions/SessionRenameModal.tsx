/**
 * SessionRenameModal
 *
 * Modal for renaming a session.
 */

import { useState, useEffect, useRef } from "preact/hooks";
import type { Session } from "@/types/sessions";
import { t } from "@/lib/i18n";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { getSessionLabel } from "./SessionItem";

interface SessionRenameModalProps {
  session: Session | null;
  onClose: () => void;
  onRename: (session: Session, newLabel: string) => void;
}

export function SessionRenameModal({ session, onClose, onRename }: SessionRenameModalProps) {
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset and focus when session changes
  useEffect(() => {
    if (session) {
      setLabel(getSessionLabel(session));
      // Focus input after modal animation
      setTimeout(() => inputRef.current?.select(), 100);
    }
  }, [session]);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!session || !label.trim()) return;

    setSaving(true);
    try {
      await onRename(session, label.trim());
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!session) return null;

  return (
    <Modal open={!!session} onClose={onClose} title={t("sessions.rename")}>
      <form onSubmit={handleSubmit}>
        <FormField label={t("sessions.label")} htmlFor="session-label">
          <Input
            ref={inputRef}
            id="session-label"
            type="text"
            value={label}
            onInput={(e) => setLabel((e.target as HTMLInputElement).value)}
            placeholder={t("sessions.labelPlaceholder")}
            fullWidth
          />
        </FormField>

        <div class="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t("actions.cancel")}
          </Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!label.trim()}>
            {t("actions.save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
