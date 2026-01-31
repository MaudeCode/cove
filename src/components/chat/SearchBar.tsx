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
import { IconButton, DatePicker, SearchIcon, CloseIcon, XIcon } from "@/components/ui";
import { hasContent } from "@/lib/utils";
import { t } from "@/lib/i18n";

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
    <div class="flex items-center gap-3 px-3 py-2 bg-[var(--color-bg-surface)] border-b border-[var(--color-border)]">
      {/* Search icon */}
      <SearchIcon class="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0" />

      {/* Text search input */}
      <input
        ref={inputRef}
        type="text"
        value={searchQuery.value}
        onInput={(e) => (searchQuery.value = (e.target as HTMLInputElement).value)}
        placeholder={t("chat.searchPlaceholder")}
        class="flex-1 min-w-[120px] px-2.5 py-1.5 text-sm rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]/50 transition-colors"
      />

      {/* Date range */}
      <div class="flex items-center gap-1.5 flex-shrink-0">
        <DatePicker
          value={dateRangeStart.value}
          onChange={(date) => (dateRangeStart.value = date)}
          placeholder="From"
          class="w-[130px]"
        />
        <span class="text-[var(--color-text-muted)] text-sm">–</span>
        <DatePicker
          value={dateRangeEnd.value}
          onChange={(date) => (dateRangeEnd.value = date)}
          placeholder="To"
          class="w-[130px]"
        />
        {hasDateFilter.value && (
          <button
            type="button"
            onClick={clearDateFilter}
            class="p-1 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
            title={t("actions.clear")}
          >
            <XIcon class="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Match count */}
      {hasFilters && (
        <span class="text-xs text-[var(--color-text-muted)] whitespace-nowrap flex-shrink-0">
          {matchCount} {matchCount === 1 ? t("chat.match") : t("chat.matches")}
        </span>
      )}

      {/* Close button */}
      <IconButton
        icon={<CloseIcon />}
        label={t("actions.close")}
        onClick={closeSearch}
        variant="ghost"
        size="sm"
      />
    </div>
  );
}
