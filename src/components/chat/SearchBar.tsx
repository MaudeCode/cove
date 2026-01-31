/**
 * SearchBar
 *
 * Search bar for filtering messages in chat history.
 */

import { useRef, useEffect, useCallback } from "preact/hooks";
import { searchQuery, isSearchOpen, searchMatchCount } from "@/signals/chat";
import { Input, IconButton, SearchIcon, CloseIcon } from "@/components/ui";
import { hasContent } from "@/lib/utils";
import { t } from "@/lib/i18n";

export function SearchBar() {
  const inputRef = useRef<HTMLInputElement>(null);

  /** Close search and clear query */
  const closeSearch = useCallback(() => {
    isSearchOpen.value = false;
    searchQuery.value = "";
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

  return (
    <div class="flex items-center gap-2 px-3 py-2 bg-[var(--color-bg-surface)] border-b border-[var(--color-border)]">
      <SearchIcon class="w-4 h-4 text-[var(--color-text-muted)]" />
      <Input
        ref={inputRef}
        type="text"
        value={searchQuery.value}
        onInput={(e) => (searchQuery.value = (e.target as HTMLInputElement).value)}
        placeholder={t("chat.searchPlaceholder")}
        class="flex-1 !bg-transparent !border-none !shadow-none !ring-0 text-sm"
      />
      {hasQuery && (
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
  );
}
