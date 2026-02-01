/**
 * MiniStat
 *
 * Small centered stat display for modals/detail views.
 */

interface MiniStatProps {
  /** Main value */
  value: string;
  /** Label below the value */
  label: string;
}

export function MiniStat({ value, label }: MiniStatProps) {
  return (
    <div class="text-center p-4 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
      <div class="text-xl font-bold">{value}</div>
      <div class="text-sm text-[var(--color-text-muted)]">{label}</div>
    </div>
  );
}
