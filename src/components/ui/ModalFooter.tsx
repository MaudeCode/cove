/**
 * ModalFooter Components
 *
 * Reusable footer patterns for modals with edit/delete functionality.
 */

import type { ComponentChildren } from "preact";
import { t } from "@/lib/i18n";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import { Trash2 } from "lucide-preact";

// ============================================
// Basic ModalFooter (Cancel + Confirm)
// ============================================

interface ModalFooterProps {
  /** Called when cancel is clicked */
  onCancel: () => void;
  /** Called when confirm is clicked */
  onConfirm: () => void;
  /** Label for confirm button */
  confirmLabel?: string;
  /** Disable confirm button */
  confirmDisabled?: boolean;
  /** Cancel button label */
  cancelLabel?: string;
}

/**
 * Simple modal footer with cancel and confirm buttons.
 */
export function ModalFooter({
  onCancel,
  onConfirm,
  confirmLabel,
  confirmDisabled,
  cancelLabel,
}: ModalFooterProps) {
  return (
    <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
      <Button variant="secondary" onClick={onCancel} fullWidth class="sm:w-auto">
        {cancelLabel || t("actions.cancel")}
      </Button>
      <Button onClick={onConfirm} disabled={confirmDisabled} fullWidth class="sm:w-auto">
        {confirmLabel || t("actions.confirm")}
      </Button>
    </div>
  );
}

// ============================================
// Delete Confirmation Footer
// ============================================

interface DeleteConfirmFooterProps {
  /** Confirmation message to display */
  message: string;
  /** Called when cancel is clicked */
  onCancel: () => void;
  /** Called when delete is confirmed */
  onDelete: () => void;
  /** Whether delete is in progress */
  isDeleting?: boolean;
}

/**
 * Delete confirmation footer - shows message + cancel/delete buttons.
 * Stacks vertically on mobile, horizontal on desktop.
 */
export function DeleteConfirmFooter({
  message,
  onCancel,
  onDelete,
  isDeleting,
}: DeleteConfirmFooterProps) {
  return (
    <div class="space-y-3">
      <p class="text-sm text-[var(--color-error)] text-center sm:text-left">{message}</p>
      <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} fullWidth class="sm:w-auto">
          {t("actions.cancel")}
        </Button>
        <Button
          variant="danger"
          icon={<Trash2 class="w-4 h-4" />}
          onClick={onDelete}
          disabled={isDeleting}
          fullWidth
          class="sm:w-auto"
        >
          {isDeleting ? <Spinner size="sm" /> : t("actions.delete")}
        </Button>
      </div>
    </div>
  );
}

interface EditFooterProps {
  /** Called when cancel is clicked */
  onCancel: () => void;
  /** Called when save is clicked */
  onSave: () => void;
  /** Whether save is in progress */
  isSaving?: boolean;
  /** Label for save button (defaults to "Save") */
  saveLabel?: string;
  /** Whether this is for editing (shows delete) or creating */
  isEdit?: boolean;
  /** Called when delete button is clicked (to show confirmation) */
  onDeleteClick?: () => void;
  /** Extra content next to buttons on desktop, below buttons on mobile */
  extraContent?: ComponentChildren;
}

/**
 * Standard edit footer - delete on left, cancel/save on right.
 * On mobile: buttons on top, delete + extra content on bottom row.
 */
export function EditFooter({
  onCancel,
  onSave,
  isSaving,
  saveLabel,
  isEdit,
  onDeleteClick,
  extraContent,
}: EditFooterProps) {
  return (
    <div class="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
      {/* Bottom row on mobile: delete + extra content */}
      <div class="flex items-center justify-between sm:justify-start gap-3">
        {isEdit && onDeleteClick && (
          <Button
            size="sm"
            variant="ghost"
            icon={<Trash2 class="w-4 h-4" />}
            onClick={onDeleteClick}
            class="text-[var(--color-error)] hover:bg-[var(--color-error)]/10"
          >
            {t("actions.delete")}
          </Button>
        )}
        {/* Extra content - shown on mobile in this row, desktop too */}
        {extraContent && <div class="sm:hidden">{extraContent}</div>}
      </div>

      {/* Top row on mobile: extra content (desktop) + buttons */}
      <div class="flex flex-col sm:flex-row sm:items-center gap-3">
        {extraContent && <div class="hidden sm:block">{extraContent}</div>}
        <div class="flex flex-col sm:flex-row gap-2">
          <Button variant="secondary" onClick={onCancel} fullWidth class="sm:w-auto">
            {t("actions.cancel")}
          </Button>
          <Button onClick={onSave} disabled={isSaving} fullWidth class="sm:w-auto">
            {isSaving ? <Spinner size="sm" /> : saveLabel || t("actions.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
