/**
 * Skeleton Component
 *
 * Loading placeholder with shimmer animation.
 */

export interface SkeletonProps {
  /** Width (CSS value) */
  width?: string | number;
  /** Height (CSS value) */
  height?: string | number;
  /** Border radius */
  rounded?: "none" | "sm" | "md" | "lg" | "full";
  /** Additional class names */
  class?: string;
}

const roundedStyles: Record<NonNullable<SkeletonProps["rounded"]>, string> = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  full: "rounded-full",
};

export function Skeleton({ width, height, rounded = "md", class: className }: SkeletonProps) {
  const style: Record<string, string | number> = {};

  if (width) {
    style.width = typeof width === "number" ? `${width}px` : width;
  }
  if (height) {
    style.height = typeof height === "number" ? `${height}px` : height;
  }

  return (
    <div
      class={`
        animate-pulse
        bg-[var(--color-bg-secondary)]
        ${roundedStyles[rounded]}
        ${className || ""}
      `}
      style={style}
      aria-hidden="true"
    />
  );
}

/**
 * Skeleton text line
 */
export function SkeletonText({ lines = 1, class: className }: { lines?: number; class?: string }) {
  return (
    <div class={`space-y-2 ${className || ""}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 && lines > 1 ? "75%" : "100%"} height={16} />
      ))}
    </div>
  );
}

/**
 * Skeleton avatar
 */
export function SkeletonAvatar({ size = 40, class: className }: { size?: number; class?: string }) {
  return <Skeleton width={size} height={size} rounded="full" class={className} />;
}
