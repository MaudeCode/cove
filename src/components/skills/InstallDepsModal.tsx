/**
 * InstallDepsModal
 *
 * Modal for installing skill dependencies.
 */

import { signal } from "@preact/signals";
import { t } from "@/lib/i18n";
import { send } from "@/lib/gateway";
import { getErrorMessage } from "@/lib/session-utils";
import { toast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Download } from "lucide-preact";
import type { SkillStatusEntry } from "@/types/skills";

// ============================================
// State
// ============================================

const isInstalling = signal(false);

// ============================================
// Component
// ============================================

interface InstallDepsModalProps {
  skill: SkillStatusEntry | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function InstallDepsModal({ skill, onClose, onSuccess }: InstallDepsModalProps) {
  if (!skill) return null;

  const handleInstall = async (installId: string) => {
    isInstalling.value = true;

    try {
      const result = await send("skills.install", {
        name: skill.name,
        installId,
        timeoutMs: 60000,
      });

      if (result.ok) {
        toast.success(t("skills.installSuccess", { name: skill.name }));
        onClose();
        onSuccess();
      } else {
        toast.error(result.message || t("skills.installFailed"));
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      isInstalling.value = false;
    }
  };

  return (
    <Modal open={true} onClose={onClose} title={t("skills.installTitle", { name: skill.name })}>
      <div class="space-y-4">
        <p class="text-sm text-[var(--color-text-muted)]">{t("skills.installDescription")}</p>

        <div class="space-y-2">
          {skill.install.map((option) => (
            <button
              key={option.id}
              type="button"
              class="w-full flex items-center gap-3 p-3 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => handleInstall(option.id)}
              disabled={isInstalling.value}
            >
              <Download class="w-5 h-5 text-[var(--color-accent)]" />
              <div class="flex-1">
                <div class="font-medium">{option.label}</div>
                {option.bins.length > 0 && (
                  <div class="text-xs text-[var(--color-text-muted)]">
                    {t("skills.providesBins")}: {option.bins.join(", ")}
                  </div>
                )}
              </div>
              {isInstalling.value && <Spinner size="sm" />}
            </button>
          ))}
        </div>
      </div>

      <div class="mt-6 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          {t("actions.cancel")}
        </Button>
      </div>
    </Modal>
  );
}
