/**
 * WizardNav
 *
 * Reusable navigation buttons for wizard steps.
 * Back button (ghost, left arrow) + Next button (primary, right arrow).
 */

import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, ArrowRight } from "lucide-preact";

interface WizardNavProps {
  /** Handler for back button (omit to hide back button) */
  onBack?: () => void;
  /** Handler for next/continue button */
  onNext: () => void;
  /** Label for next button (defaults to "Continue") */
  nextLabel?: string;
  /** Label for back button (defaults to "Back") */
  backLabel?: string;
  /** Disable next button */
  nextDisabled?: boolean;
  /** Show loading state on next button */
  nextLoading?: boolean;
  /** Additional class for container */
  class?: string;
}

export function WizardNav({
  onBack,
  onNext,
  nextLabel,
  backLabel,
  nextDisabled = false,
  nextLoading = false,
  class: className,
}: WizardNavProps) {
  return (
    <div class={`flex gap-3 mt-6 ${className || ""}`}>
      {onBack && (
        <Button variant="ghost" onClick={onBack} icon={<ArrowLeft class="w-4 h-4" />}>
          {backLabel || t("actions.back")}
        </Button>
      )}
      <Button
        variant="primary"
        onClick={onNext}
        disabled={nextDisabled}
        loading={nextLoading}
        class={onBack ? "flex-1" : "w-full"}
        iconRight={<ArrowRight class="w-4 h-4" />}
      >
        {nextLabel || t("actions.continue")}
      </Button>
    </div>
  );
}
