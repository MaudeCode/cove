/**
 * BouncingDots
 *
 * Animated dots for loading/typing indicators with wave effect.
 */

export interface BouncingDotsProps {
  /** Dot size in pixels (default: 6 / 1.5 in Tailwind units) */
  size?: "sm" | "md";
  /** Color class (default: uses accent color) */
  colorClass?: string;
}

export function BouncingDots({ size = "md", colorClass }: BouncingDotsProps) {
  const sizeClass = size === "sm" ? "w-1 h-1" : "w-1.5 h-1.5";
  const color = colorClass ?? "bg-[var(--color-accent)]";

  return (
    <span class="inline-flex items-end gap-1">
      <span class={`${sizeClass} rounded-full ${color} animate-bounce-dot-1`} />
      <span class={`${sizeClass} rounded-full ${color} animate-bounce-dot-2`} />
      <span class={`${sizeClass} rounded-full ${color} animate-bounce-dot-3`} />
    </span>
  );
}
