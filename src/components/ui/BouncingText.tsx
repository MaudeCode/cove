import type { JSX } from "preact";

interface BouncingTextProps {
  class?: string;
  text: string;
}

type CharacterStyle = JSX.CSSProperties & {
  "--cove-bouncing-character-index": number;
};

export function BouncingText({ class: className, text }: BouncingTextProps) {
  return (
    <span aria-hidden="true" class={`cove-bouncing-text ${className ?? ""}`}>
      {Array.from(text).map((character, index) => (
        <span
          key={`${character}-${index}`}
          class="cove-bouncing-text__character"
          style={
            {
              "--cove-bouncing-character-index": index,
            } as CharacterStyle
          }
        >
          {character === " " ? "\u00A0" : character}
        </span>
      ))}
    </span>
  );
}
