import type { ComponentChildren } from "preact";

interface ShimmerTextProps {
  children: ComponentChildren;
  class?: string;
}

export function ShimmerText({ children, class: className }: ShimmerTextProps) {
  return <span class={`cove-shimmer-text ${className ?? ""}`}>{children}</span>;
}
