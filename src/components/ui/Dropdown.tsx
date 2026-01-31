/**
 * Dropdown Component
 *
 * Custom themed dropdown select. Uses button + popover pattern
 * for full styling control (unlike native <select>).
 */

import { useState, useRef, useEffect, useCallback } from "preact/hooks";
import { ChevronDown } from "lucide-preact";

export type DropdownSize = "sm" | "md" | "lg";

export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface DropdownProps {
  /** Current value */
  value: string;
  /** Options to display */
  options: DropdownOption[];
  /** Called when value changes */
  onChange: (value: string) => void;
  /** Dropdown size */
  size?: DropdownSize;
  /** Placeholder when no value selected */
  placeholder?: string;
  /** Accessible label */
  "aria-label"?: string;
  /** Additional classes for trigger button */
  class?: string;
  /** Disabled state */
  disabled?: boolean;
}

const sizeStyles: Record<DropdownSize, { trigger: string; menu: string; option: string }> = {
  sm: {
    trigger: "px-2.5 py-1.5 text-xs min-w-[100px]",
    menu: "text-xs",
    option: "px-2.5 py-1.5",
  },
  md: {
    trigger: "px-3 py-2 text-sm min-w-[120px]",
    menu: "text-sm",
    option: "px-3 py-2",
  },
  lg: {
    trigger: "px-4 py-3 text-base min-w-[140px]",
    menu: "text-base",
    option: "px-4 py-3",
  },
};

export function Dropdown({
  value,
  options,
  onChange,
  size = "md",
  placeholder = "Select...",
  "aria-label": ariaLabel,
  class: className,
  disabled = false,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const styles = sizeStyles[size];
  const selectedOption = options.find((o) => o.value === value);
  const displayLabel = selectedOption?.label ?? placeholder;

  // Close dropdown
  const close = useCallback(() => {
    setIsOpen(false);
    setFocusedIndex(-1);
  }, []);

  // Select option and close
  const selectOption = useCallback(
    (optionValue: string) => {
      onChange(optionValue);
      close();
      triggerRef.current?.focus();
    },
    [onChange, close],
  );

  // Handle click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, close]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
          e.preventDefault();
          setIsOpen(true);
          setFocusedIndex(0);
        }
        return;
      }

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          close();
          triggerRef.current?.focus();
          break;
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((i) => Math.min(i + 1, options.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (focusedIndex >= 0 && !options[focusedIndex]?.disabled) {
            selectOption(options[focusedIndex].value);
          }
          break;
        case "Tab":
          close();
          break;
      }
    },
    [isOpen, options, focusedIndex, close, selectOption],
  );

  return (
    <div class="relative inline-block">
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        class={`
          flex items-center justify-between gap-2 rounded-xl cursor-pointer
          bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]
          border border-[var(--color-border)] transition-all duration-200 ease-out
          shadow-soft-sm hover:shadow-soft focus:shadow-soft
          focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-0 focus:border-transparent
          disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
          ${styles.trigger}
          ${className || ""}
        `}
      >
        <span class="truncate">{displayLabel}</span>
        <ChevronDown
          class={`w-4 h-4 flex-shrink-0 text-[var(--color-text-muted)] transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          ref={menuRef}
          role="listbox"
          aria-label={ariaLabel}
          class={`
            absolute top-full left-0 mt-1 z-50 min-w-full
            rounded-lg border border-[var(--color-border)]
            bg-[var(--color-bg-surface)] shadow-lg
            overflow-hidden
            ${styles.menu}
          `}
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              disabled={option.disabled}
              onClick={() => !option.disabled && selectOption(option.value)}
              onMouseEnter={() => setFocusedIndex(index)}
              class={`
                w-full text-left transition-colors
                ${styles.option}
                ${option.disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                ${option.value === value ? "text-[var(--color-accent)] font-medium" : "text-[var(--color-text-primary)]"}
                ${focusedIndex === index && !option.disabled ? "bg-[var(--color-bg-hover)]" : ""}
                ${!option.disabled ? "hover:bg-[var(--color-bg-hover)]" : ""}
              `}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
