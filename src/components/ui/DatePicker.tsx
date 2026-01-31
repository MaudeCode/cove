/**
 * DatePicker
 *
 * Custom themed date picker with calendar dropdown.
 */

import { useState, useRef } from "preact/hooks";
import { useClickOutside } from "@/hooks";
import { ChevronDownIcon } from "./icons";

interface DatePickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  class?: string;
}

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatDisplayDate(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  class: className = "",
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => value ?? new Date());
  const [alignRight, setAlignRight] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setIsOpen(false), isOpen);

  // Check if dropdown would overflow right edge
  const handleOpen = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const dropdownWidth = 280;
      setAlignRight(rect.left + dropdownWidth > window.innerWidth);
    }
    setIsOpen(!isOpen);
  };

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const selectDate = (day: number) => {
    onChange(new Date(year, month, day));
    setIsOpen(false);
  };

  const isSelected = (day: number): boolean => {
    if (!value) return false;
    return value.getFullYear() === year && value.getMonth() === month && value.getDate() === day;
  };

  const isToday = (day: number): boolean => {
    const today = new Date();
    return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
  };

  // Build calendar grid
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  return (
    <div ref={containerRef} class={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={handleOpen}
        class={`
          flex items-center justify-between gap-2 w-full
          px-2.5 py-1.5 text-sm rounded-lg
          bg-[var(--color-bg-primary)]
          border border-[var(--color-border)]
          ${isOpen ? "border-[var(--color-accent)]/50" : ""}
          hover:border-[var(--color-border-hover)]
          transition-colors text-left
        `}
      >
        <span class={value ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)]"}>
          {value ? formatDisplayDate(value) : placeholder}
        </span>
        <ChevronDownIcon open={isOpen} class="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          class={`absolute top-full mt-1 z-50 p-3 rounded-lg shadow-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] min-w-[260px] ${alignRight ? "right-0" : "left-0"}`}
        >
          {/* Header with month/year nav */}
          <div class="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={prevMonth}
              class="p-1.5 rounded-md hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] transition-colors"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span class="text-sm font-medium text-[var(--color-text-primary)]">
              {MONTHS[month]} {year}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              class="p-1.5 rounded-md hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] transition-colors"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Day headers */}
          <div class="grid grid-cols-7 gap-1 mb-1">
            {DAYS.map((day) => (
              <div
                key={day}
                class="text-[10px] font-medium text-[var(--color-text-muted)] text-center py-1"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div class="grid grid-cols-7 gap-1">
            {days.map((day, idx) => (
              <div key={idx} class="aspect-square">
                {day !== null && (
                  <button
                    type="button"
                    onClick={() => selectDate(day)}
                    class={`
                      w-full h-full flex items-center justify-center
                      text-sm rounded-md transition-colors
                      ${
                        isSelected(day)
                          ? "bg-[var(--color-accent)] text-[var(--color-accent-text)] font-medium"
                          : isToday(day)
                            ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-medium"
                            : "text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]"
                      }
                    `}
                  >
                    {day}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Clear button */}
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setIsOpen(false);
              }}
              class="w-full mt-2 pt-2 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
