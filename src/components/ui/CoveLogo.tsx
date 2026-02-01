/**
 * CoveLogo
 *
 * Reusable Cove logo/icon component with size variants.
 */

type LogoSize = "sm" | "md" | "lg" | "xl";

interface CoveLogoProps {
  /** Size variant */
  size?: LogoSize;
  /** Additional CSS classes */
  class?: string;
  /** Whether to show hover animation */
  animated?: boolean;
}

const SIZE_CLASSES: Record<LogoSize, string> = {
  sm: "w-6 h-6 rounded",
  md: "w-8 h-8 rounded-lg",
  lg: "w-20 h-20 rounded-2xl",
  xl: "w-24 h-24 rounded-2xl shadow-lg",
};

export function CoveLogo({ size = "md", class: className = "", animated = false }: CoveLogoProps) {
  const sizeClass = SIZE_CLASSES[size];
  const animationClass = animated ? "group-hover:scale-110 transition-transform" : "";

  return (
    <img
      src="/cove-icon.png"
      alt="Cove"
      class={`${sizeClass} ${animationClass} ${className}`.trim()}
    />
  );
}
