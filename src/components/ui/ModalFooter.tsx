/**
 * ModalFooter
 *
 * Standardized modal footer layouts for common patterns:
 * - confirm: Cancel + Primary action (right-aligned)
 * - delete: Delete button (left) + Cancel/Confirm (right)
 * - custom: Full control via children
 */

import type { ComponentChildren } from "preact";
import { t } from "@/lib/i18n";
import { Button } from "./Button";

export interface ModalFooterProps {
  /** Footer variant */
  variant?: "confirm" | "delete" | "custom";
  /** Primary action label (defaults to "Confirm" or "Save") */
  confirmLabel?: string;
  /** Cancel action label (defaults to "Cancel") */
  cancelLabel?: string;
  /** Delete action label (defaults to "Delete") */
  deleteLabel?: string;
  /** Called when confirm/save is clicked */
  onConfirm?: () => void;
  /** Called when cancel is clicked */
  onCancel?: () => void;
  /** Called when delete is clicked */
  onDelete?: () => void;
  /** Whether the confirm button is disabled */
  confirmDisabled?: boolean;
  /** Whether the delete button is disabled */
  deleteDisabled?: boolean;
  /** Whether an action is in progress (shows loading state) */
  isLoading?: boolean;
  /** Loading label (shown during loading) */
  loadingLabel?: string;
  /** For delete variant: whether delete confirmation is showing */
  isDeleting?: boolean;
  /** For delete variant: called to toggle delete confirmation */
  onSetDeleting?: (deleting: boolean) => void;
  /** Custom children (for variant="custom") */
  children?: ComponentChildren;
}

export function ModalFooter({
  variant = "confirm",
  confirmLabel,
  cancelLabel,
  deleteLabel,
  onConfirm,
  onCancel,
  onDelete,
  confirmDisabled = false,
  deleteDisabled = false,
  isLoading = false,
  loadingLabel,
  isDeleting = false,
  onSetDeleting,
  children,
}: ModalFooterProps) {
  // Custom variant - just render children
  if (variant === "custom") {
    return <div class="flex items-center justify-end gap-2">{children}</div>;
  }

  // Delete variant - delete on left, cancel/confirm on right
  if (variant === "delete") {
    return (
      <div class="flex items-center justify-between">
        <div>
          {isDeleting ? (
            <div class="flex items-center gap-2">
              <span class="text-sm text-[var(--color-error)]">{t("common.confirmDelete")}</span>
              <Button size="sm" variant="ghost" onClick={() => onSetDeleting?.(false)}>
                {cancelLabel ?? t("actions.cancel")}
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={onDelete}
                disabled={deleteDisabled || isLoading}
              >
                {isLoading
                  ? (loadingLabel ?? t("common.deleting"))
                  : (deleteLabel ?? t("actions.delete"))}
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onSetDeleting?.(true)}
              disabled={deleteDisabled}
            >
              {deleteLabel ?? t("actions.delete")}
            </Button>
          )}
        </div>
        <div class="flex items-center gap-2">
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel ?? t("actions.cancel")}
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={confirmDisabled || isLoading}>
            {isLoading ? (loadingLabel ?? t("common.saving")) : (confirmLabel ?? t("actions.save"))}
          </Button>
        </div>
      </div>
    );
  }

  // Default confirm variant - cancel + confirm right-aligned
  return (
    <div class="flex items-center justify-end gap-2">
      <Button variant="ghost" onClick={onCancel}>
        {cancelLabel ?? t("actions.cancel")}
      </Button>
      <Button variant="primary" onClick={onConfirm} disabled={confirmDisabled || isLoading}>
        {isLoading ? (loadingLabel ?? t("common.saving")) : (confirmLabel ?? t("actions.confirm"))}
      </Button>
    </div>
  );
}
