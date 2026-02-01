/**
 * ChipButton
 *
 * Small selectable chip/pill button for preset options.
 * Used for quick-pick values like cron presets, intervals, etc.
 */

interface ChipButtonProps {
  /** Button label */
  label: string;
  /** Whether this chip is selected */
  selected?: boolean;
  /** Click handler */
  onClick: () => void;
  /** Optional title/tooltip */
  title?: string;
  /** Size variant */
  size?: "sm" | "md";
}

export function ChipButton({ label, selected, onClick, title, size = "md" }: ChipButtonProps) {
  const sizeClasses = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm";

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      class={`
        ${sizeClasses} rounded-lg border transition-colors
        ${
          selected
            ? "bg-[var(--color-accent)]/10 border-[var(--color-accent)] text-[var(--color-accent)]"
            : "border-[var(--color-border)] hover:border-[var(--color-border-hover)] text-[var(--color-text-muted)]"
        }
      `}
    >
      {label}
    </button>
  );
}

interface ChipButtonGroupProps<T extends string | number> {
  /** Available options */
  options: Array<{ value: T; label: string }>;
  /** Currently selected value */
  value: T | null;
  /** Change handler */
  onChange: (value: T) => void;
  /** Size variant */
  size?: "sm" | "md";
}

export function ChipButtonGroup<T extends string | number>({
  options,
  value,
  onChange,
  size = "md",
}: ChipButtonGroupProps<T>) {
  return (
    <div class="flex flex-wrap gap-2">
      {options.map((opt) => (
        <ChipButton
          key={opt.value}
          label={opt.label}
          selected={value === opt.value}
          onClick={() => onChange(opt.value)}
          title={String(opt.value)}
          size={size}
        />
      ))}
    </div>
  );
}
