/**
 * WizardProgress
 *
 * Step indicator dots for multi-step wizards.
 * Active and completed steps are highlighted and wider.
 */

interface WizardProgressProps<T extends string> {
  /** All steps in order */
  steps: readonly T[];
  /** Current active step */
  current: T;
  /** Additional class */
  class?: string;
}

export function WizardProgress<T extends string>({
  steps,
  current,
  class: className,
}: WizardProgressProps<T>) {
  const currentIndex = steps.indexOf(current);

  return (
    <div class={`flex justify-center gap-2 ${className || ""}`}>
      {steps.map((step, i) => (
        <div
          key={step}
          class={`h-1.5 rounded-full transition-all duration-300 ${
            i <= currentIndex ? "w-8 bg-[var(--color-accent)]" : "w-4 bg-[var(--color-border)]"
          }`}
        />
      ))}
    </div>
  );
}
