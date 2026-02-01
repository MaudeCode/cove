/**
 * SessionFilters
 *
 * Filter controls for session list: search, kind filter, cron toggle.
 */

import { useState, useRef, useEffect } from "preact/hooks";
import { t } from "@/lib/i18n";
import {
  sessionKindFilter,
  setSessionKindFilter,
  sessionSearchQuery,
  setSessionSearchQuery,
  showCronSessions,
  toggleCronSessions,
} from "@/signals/sessions";
import { Toggle } from "@/components/ui/Toggle";
import { Chip } from "@/components/ui/Chip";
import { FilterIcon, SearchIcon, XIcon } from "@/components/ui/icons";

export function SessionFilters() {
  const [showFilters, setShowFilters] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasSearch = sessionSearchQuery.value.trim() !== "";
  const hasKindFilter = sessionKindFilter.value !== null;
  const hasActiveFilters = hasSearch || hasKindFilter || showCronSessions.value;

  // Keep filters open if there are active filters
  useEffect(() => {
    if (hasActiveFilters) setShowFilters(true);
  }, [hasActiveFilters]);

  // Focus search when opening filters
  useEffect(() => {
    if (showFilters && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showFilters]);

  const kinds = [
    { value: null, label: t("sessions.filterAll") },
    { value: "main", label: t("sessions.filterMain") },
    { value: "isolated", label: t("sessions.filterIsolated") },
    { value: "channel", label: t("sessions.filterChannel") },
  ];

  return (
    <div class="px-2 py-1.5">
      {/* Title row with buttons */}
      <div class="flex items-center justify-between">
        <h3 class="text-xs font-semibold text-[var(--color-accent)] uppercase tracking-wider">
          {t("nav.sessions")}
        </h3>
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          class={`p-1 rounded transition-colors ${
            hasActiveFilters
              ? "text-[var(--color-accent)] bg-[var(--color-accent)]/10"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
          }`}
          aria-label={t("sessions.filterSessions")}
        >
          <FilterIcon class="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Expanded filter panel - inline, not a popup */}
      {showFilters && (
        <div class="mt-2 space-y-2">
          {/* Search input */}
          <div class="relative">
            <SearchIcon class="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <input
              ref={inputRef}
              type="text"
              value={sessionSearchQuery.value}
              onInput={(e) => setSessionSearchQuery((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && !hasActiveFilters) {
                  setShowFilters(false);
                }
              }}
              placeholder={t("sessions.searchPlaceholder")}
              class="w-full pl-7 pr-7 py-1.5 text-xs rounded-md
                bg-[var(--color-bg-primary)] border border-[var(--color-border)]
                text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]
                focus:outline-none focus:border-[var(--color-accent)]/50"
            />
            {hasSearch && (
              <button
                type="button"
                onClick={() => setSessionSearchQuery("")}
                class="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded
                  text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              >
                <XIcon class="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Kind filter chips */}
          <div class="flex flex-wrap gap-1">
            {kinds.map((kind) => (
              <Chip
                key={kind.value ?? "all"}
                size="xs"
                selected={sessionKindFilter.value === kind.value}
                onClick={() => setSessionKindFilter(kind.value)}
              >
                {kind.label}
              </Chip>
            ))}
          </div>

          {/* Cron toggle */}
          <Toggle
            size="sm"
            checked={showCronSessions.value}
            onChange={toggleCronSessions}
            label={t("sessions.showCron")}
          />
        </div>
      )}
    </div>
  );
}
