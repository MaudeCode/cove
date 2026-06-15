import type { JSX } from "preact";

interface TextShimmerProps {
  class?: string;
  style?: string | JSX.CSSProperties;
  text: string;
}

export function TextShimmer({ class: className, style, text }: TextShimmerProps) {
  return (
    <span class={`tool-call-running-text ${className ?? ""}`.trim()} style={style}>
      {text}
    </span>
  );
}
