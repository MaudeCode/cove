/**
 * AutocompleteInput
 *
 * Styled text input with compact, keyboard-friendly suggestion menu.
 */

import type { JSX } from "preact";
import { useCallback, useRef, useState } from "preact/hooks";
import { XCircle } from "lucide-preact";
import { useClickOutside } from "@/hooks/useClickOutside";
import { Input } from "./Input";

let autocompleteInstanceCount = 0;

interface AutocompleteInputProps extends Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onInput" | "size"
> {
  value: string;
  onValueChange: (value: string) => void;
  suggestions: string[];
  onSelectSuggestion?: (value: string) => void;
  minCharsToOpen?: number;
  clearable?: boolean;
  clearAriaLabel?: string;
  fullWidth?: boolean;
}

export function AutocompleteInput({
  value,
  onValueChange,
  suggestions,
  onSelectSuggestion,
  minCharsToOpen = 2,
  clearable = false,
  clearAriaLabel = "Clear",
  fullWidth = false,
  ...inputProps
}: AutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxIdRef = useRef<string>("");

  if (!listboxIdRef.current) {
    autocompleteInstanceCount += 1;
    listboxIdRef.current = `autocomplete-input-${autocompleteInstanceCount}-listbox`;
  }

  const canOpen = value.trim().length >= minCharsToOpen;
  const visibleSuggestions = canOpen ? suggestions : [];
  const showSuggestions = isOpen && visibleSuggestions.length > 0;
  const activeDescendantId =
    showSuggestions && activeIndex >= 0
      ? `${listboxIdRef.current}-option-${activeIndex}`
      : undefined;

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setActiveIndex(-1);
  }, []);

  useClickOutside(containerRef, closeMenu, isOpen);

  const selectSuggestion = useCallback(
    (nextValue: string) => {
      onValueChange(nextValue);
      onSelectSuggestion?.(nextValue);
      closeMenu();
    },
    [closeMenu, onSelectSuggestion, onValueChange],
  );

  const onKeyDown: JSX.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "ArrowDown") {
      if (!showSuggestions) {
        if (visibleSuggestions.length > 0) {
          e.preventDefault();
          setIsOpen(true);
          setActiveIndex(0);
        }
        return;
      }
      e.preventDefault();
      setActiveIndex((idx) => Math.min(idx + 1, visibleSuggestions.length - 1));
      return;
    }

    if (e.key === "ArrowUp" && showSuggestions) {
      e.preventDefault();
      setActiveIndex((idx) => Math.max(idx - 1, 0));
      return;
    }

    if (e.key === "Enter" && showSuggestions && activeIndex >= 0) {
      e.preventDefault();
      selectSuggestion(visibleSuggestions[activeIndex]);
      return;
    }

    if (e.key === "Escape" && isOpen) {
      e.preventDefault();
      closeMenu();
      return;
    }

    if (e.key === "Tab" && isOpen) {
      closeMenu();
    }
  };

  const showClearButton = clearable && value.trim().length > 0;

  return (
    <div ref={containerRef} class={`relative ${fullWidth ? "w-full" : ""}`}>
      <Input
        {...inputProps}
        ref={inputRef}
        value={value}
        onInput={(e) => {
          onValueChange((e.target as HTMLInputElement).value);
          if (!isOpen) setIsOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => {
          if (canOpen && visibleSuggestions.length > 0) {
            setIsOpen(true);
          }
        }}
        onKeyDown={onKeyDown}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showSuggestions}
        aria-controls={listboxIdRef.current}
        aria-activedescendant={activeDescendantId}
        rightElement={
          showClearButton ? (
            <button
              type="button"
              aria-label={clearAriaLabel}
              class="rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-0"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onValueChange("");
                setActiveIndex(-1);
                setIsOpen(true);
                inputRef.current?.focus();
              }}
            >
              <XCircle class="w-4 h-4" />
            </button>
          ) : undefined
        }
        fullWidth={fullWidth}
      />

      {showSuggestions && (
        <div
          id={listboxIdRef.current}
          role="listbox"
          class="absolute z-30 top-full mt-1 left-0 right-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-lg overflow-y-auto max-h-56"
        >
          {visibleSuggestions.map((item, idx) => (
            <button
              id={`${listboxIdRef.current}-option-${idx}`}
              key={item}
              type="button"
              role="option"
              aria-selected={idx === activeIndex}
              class={`w-full text-left px-3 py-2 text-sm transition-colors ${
                idx === activeIndex
                  ? "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
              }`}
              onMouseEnter={() => setActiveIndex(idx)}
              onMouseDown={(e) => {
                e.preventDefault();
                selectSuggestion(item);
              }}
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
