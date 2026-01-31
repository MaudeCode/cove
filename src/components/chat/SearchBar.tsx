/**
 * SearchBar
 *
 * Search bar for filtering messages in chat history.
 * Includes text search and date range filter.
 */

import { useRef, useEffect, useCallback } from "preact/hooks";
import {
  searchQuery,
  isSearchOpen,
  searchMatchCount,
  dateRangeStart,
  dateRangeEnd,
  hasDateFilter,
  clearDateFilter,
} from "@/signals/chat";
import { Input, IconButton, SearchIcon, CloseIcon, XIcon } from "@/components/ui";
import { hasContent } from "@/lib/utils";
import { t } from "@/lib/i18n";

/** Format date for input[type=date] value (YYYY-MM-DD) */
function formatDateInput(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().split("T")[0];
}

/** Parse date from input[type=date] value */
function parseDateInput(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value + "T00:00:00");
  return isNaN(date.getTime()) ? null : date;
}

export function SearchBar() {
  const inputRef = useRef<HTMLInputElement>(null);

  /** Close search and clear all filters */
  const closeSearch = useCallback(() => {
    isSearchOpen.value = false;
    searchQuery.value = "";
    clearDateFilter();
  }, []);

  // Focus input when search opens
  useEffect(() => {
    if (isSearchOpen.value && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSearchOpen.value]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + F to open search
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        isSearchOpen.value = true;
      }
      // Escape to close search
      if (e.key === "Escape" && isSearchOpen.value) {
        closeSearch();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeSearch]);

  if (!isSearchOpen.value) {
    return (
      <div class="flex items-center">
        <IconButton
          icon={<SearchIcon />}
          label={t("chat.search")}
          onClick={() => (isSearchOpen.value = true)}
          variant="ghost"
          size="sm"
        />
      </div>
    );
  }

  const matchCount = searchMatchCount.value;
  const hasQuery = hasContent(searchQuery.value);
  const hasFilters = hasQuery || hasDateFilter.value;

  return (
    <div class="flex flex-col gap-2 px-3 py-2 bg-[var(--color-bg-surface)] border-b border-[var(--color-border)]">
      {/* Text search row */}
      <div class="flex items-center gap-2">
        <SearchIcon class="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0" />
        <Input
          ref={inputRef}
          type="text"
          value={searchQuery.value}
          onInput={(e) => (searchQuery.value = (e.target as HTMLInputElement).value)}
          placeholder={t("chat.searchPlaceholder")}
          class="flex-1 !bg-transparent !border-none !shadow-none !ring-0 text-sm"
        />
        {hasFilters && (
          <span class="text-xs text-[var(--color-text-muted)] whitespace-nowrap">
            {matchCount} {matchCount === 1 ? t("chat.match") : t("chat.matches")}
          </span>
        )}
        <IconButton
          icon={<CloseIcon />}
          label={t("actions.close")}
          onClick={closeSearch}
          variant="ghost"
          size="sm"
        />
      </div>

      {/* Date range row */}
      <div class="flex items-center gap-2 text-sm">
        <span class="text-[var(--color-text-muted)] text-xs">{t("chat.dateRange")}:</span>
        <input
          type="date"
          value={formatDateInput(dateRangeStart.value)}
          onChange={(e) =>
            (dateRangeStart.value = parseDateInput((e.target as HTMLInputElement).value))
          }
          class="px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
        />
        <span class="text-[var(--color-text-muted)]">—</span>
        <input
          type="date"
          value={formatDateInput(dateRangeEnd.value)}
          onChange={(e) =>
            (dateRangeEnd.value = parseDateInput((e.target as HTMLInputElement).value))
          }
          class="px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
        />
        {hasDateFilter.value && (
          <button
            type="button"
            onClick={clearDateFilter}
            class="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]"
            title={t("actions.clear")}
          >
            <XIcon class="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
