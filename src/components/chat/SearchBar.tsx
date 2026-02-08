/**
 * SearchBar
 *
 * Search bar for filtering messages in chat history.
 * Includes text search and date range filter.
 *
 * Both collapsed and expanded states render in the same container
 * to prevent layout shifts when toggling.
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
import { canvasPanelOpen } from "@/signals/ui";
import { canvasNodeEnabled } from "@/signals/settings";
import { IconButton } from "@/components/ui/IconButton";
import { DatePicker } from "@/components/ui/DatePicker";
import { SearchIcon, XIcon, CanvasIcon } from "@/components/ui/icons";
import { HeartbeatIndicator } from "./HeartbeatIndicator";
import { hasContent } from "@/lib/utils";
import { t } from "@/lib/i18n";

export function SearchBar() {
  const inputRef = useRef<HTMLInputElement>(null);
  const isOpen = isSearchOpen.value;

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

  const matchCount = searchMatchCount.value;
  const hasQuery = hasContent(searchQuery.value);
  const hasFilters = hasQuery || hasDateFilter.value;

  return (
    <>
      {/* Collapsed state - floating buttons (hidden on mobile) */}
      <div
        class={`hidden sm:flex absolute top-2 left-2 z-10 items-center gap-2 transition-opacity ${isOpen ? "opacity-0 pointer-events-none" : "opacity-100"}`}
      >
        <IconButton
          icon={<SearchIcon />}
          label={t("chat.search")}
          onClick={() => (isSearchOpen.value = true)}
          variant="ghost"
          size="sm"
          class="border border-[var(--color-border)] bg-[var(--color-bg-surface)]"
        />
        <HeartbeatIndicator />
        <div data-tour="canvas" class={canvasNodeEnabled.value ? undefined : "hidden"}>
          <IconButton
            icon={<CanvasIcon />}
            label={t("canvas.title")}
            onClick={() => (canvasPanelOpen.value = !canvasPanelOpen.value)}
            variant="ghost"
            size="sm"
            class="border border-[var(--color-border)] bg-[var(--color-bg-surface)]"
          />
        </div>
      </div>

      {/* Expanded state - full search bar */}
      <div
        class={`absolute top-0 left-0 right-0 z-10 flex items-center gap-3 px-3 py-2 bg-[var(--color-bg-surface)] border-b border-[var(--color-border)] transition-opacity ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        {/* Close button - on left so it's easy to close if opened accidentally */}
        <IconButton
          icon={<XIcon />}
          label={t("actions.close")}
          onClick={closeSearch}
          variant="ghost"
          size="sm"
          tabIndex={isOpen ? 0 : -1}
        />

        {/* Text search input */}
        <div class="flex-1 flex items-center gap-2 min-w-[120px]">
          <input
            ref={inputRef}
            type="text"
            value={searchQuery.value}
            onInput={(e) => (searchQuery.value = (e.target as HTMLInputElement).value)}
            placeholder={t("chat.searchPlaceholder")}
            class="flex-1 px-2.5 py-1.5 text-sm rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]/50 transition-colors"
            tabIndex={isOpen ? 0 : -1}
          />
          {/* Match count - inline with search to avoid layout shift */}
          {hasFilters && (
            <span class="text-xs text-[var(--color-text-muted)] whitespace-nowrap">
              {matchCount} {matchCount === 1 ? t("chat.match") : t("chat.matches")}
            </span>
          )}
        </div>

        {/* Date range - hidden on mobile */}
        <div class="hidden sm:flex items-center gap-1.5 flex-shrink-0">
          <DatePicker
            value={dateRangeStart.value}
            onChange={(date) => (dateRangeStart.value = date)}
            placeholder={t("chat.dateFrom")}
            class="w-[130px]"
            maxDate={dateRangeEnd.value}
          />
          <span class="text-[var(--color-text-muted)] text-sm">–</span>
          <DatePicker
            value={dateRangeEnd.value}
            onChange={(date) => (dateRangeEnd.value = date)}
            placeholder={t("chat.dateTo")}
            class="w-[130px]"
            minDate={dateRangeStart.value}
          />
        </div>
      </div>
    </>
  );
}
