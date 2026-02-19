/**
 * Command Palette Component
 *
 * A keyboard-driven command interface for power users.
 * Open with ⌘K (Mac) or Ctrl+K (Windows/Linux).
 */

import { useState, useEffect, useRef, useMemo } from "preact/hooks";
import { signal } from "@preact/signals";
import { t } from "@/lib/i18n";
import { getAvailableCommands } from "./commands";
import { getCategoryLabel, CATEGORY_ORDER } from "./types";
import type { Command, SubMenuItem, CommandCategory } from "./types";

// Global signal for palette visibility
export const commandPaletteOpen = signal(false);

// Recent commands (persisted to localStorage)
const RECENT_KEY = "cove:command-palette:recent";
const MAX_RECENT = 5;

function getRecentCommandIds(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addRecentCommand(id: string) {
  const recent = getRecentCommandIds().filter((r) => r !== id);
  recent.unshift(id);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

/**
 * Fuzzy match score - higher is better match
 */
function fuzzyMatch(query: string, text: string): number {
  const q = query.toLowerCase();
  const txt = text.toLowerCase();

  // Exact match
  if (txt === q) return 100;

  // Starts with query
  if (txt.startsWith(q)) return 90;

  // Contains query as substring
  if (txt.includes(q)) return 70;

  // Fuzzy character match
  let score = 0;
  let qi = 0;
  for (let ti = 0; ti < txt.length && qi < q.length; ti++) {
    if (txt[ti] === q[qi]) {
      score += 10;
      qi++;
    }
  }

  return qi === q.length ? score : 0;
}

/**
 * Score a command against a search query
 */
function scoreCommand(cmd: Command, query: string): number {
  if (!query) return 0;

  let maxScore = fuzzyMatch(query, cmd.label);

  // Check keywords
  if (cmd.keywords) {
    for (const keyword of cmd.keywords) {
      const keyScore = fuzzyMatch(query, keyword);
      if (keyScore > maxScore) maxScore = keyScore;
    }
  }

  // Check category
  const catScore = fuzzyMatch(query, getCategoryLabel(cmd.category));
  if (catScore > maxScore) maxScore = catScore;

  return maxScore;
}

/**
 * Get CSS classes for a selectable item
 */
function getItemClass(isSelected: boolean): string {
  return `w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
    isSelected ? "bg-[var(--color-bg-secondary)]" : "hover:bg-[var(--color-bg-secondary)]/50"
  }`;
}

export function CommandPalette() {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [submenu, setSubmenu] = useState<{ command: Command; items: SubMenuItem[] } | null>(null);
  const [submenuLoading, setSubmenuLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const isOpen = commandPaletteOpen.value;

  // Get filtered and sorted commands
  const commands = getAvailableCommands();
  const recentIds = getRecentCommandIds();

  const filteredCommands = useMemo(() => {
    if (query) {
      // Filter and sort by score
      return commands
        .map((cmd) => ({ cmd, score: scoreCommand(cmd, query) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .map(({ cmd }) => cmd);
    } else {
      // Show recent first, then by category
      const recent = recentIds
        .map((id) => commands.find((c) => c.id === id))
        .filter((c): c is Command => c !== undefined);

      const nonRecent = commands.filter((c) => !recentIds.includes(c.id));
      return [...recent, ...nonRecent];
    }
  }, [commands, recentIds, query]);

  // Group commands by category for display
  const groupedCommands = useMemo(() => {
    if (query) return null;
    return groupByCategory(filteredCommands, recentIds);
  }, [filteredCommands, recentIds, query]);

  // Filter submenu items by query
  const filteredSubmenuItems = useMemo(() => {
    if (!submenu) return [];
    if (!query) return submenu.items;

    const q = query.toLowerCase();
    return submenu.items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.description?.toLowerCase().includes(q) ?? false),
    );
  }, [submenu, query]);

  // Current items for keyboard navigation
  const currentItems = submenu ? filteredSubmenuItems : filteredCommands;

  // Selected item ID for aria-activedescendant
  const selectedItemId = useMemo(() => {
    if (submenu && filteredSubmenuItems[selectedIndex]) {
      return `cmd-sub-${filteredSubmenuItems[selectedIndex].id}`;
    }
    if (filteredCommands[selectedIndex]) {
      return `cmd-${filteredCommands[selectedIndex].id}`;
    }
    return undefined;
  }, [submenu, filteredSubmenuItems, filteredCommands, selectedIndex]);

  // Reset selection when query or submenu changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, submenu]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setSubmenu(null);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!commandPaletteOpen.value) return;

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (submenu) {
          setSubmenu(null);
          setQuery("");
          setSelectedIndex(0);
        } else {
          commandPaletteOpen.value = false;
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, currentItems.length - 1));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        if (submenu) {
          const item = filteredSubmenuItems[selectedIndex];
          if (item) {
            executeSubmenuItem(item);
          }
        } else {
          const cmd = filteredCommands[selectedIndex];
          if (cmd) {
            executeCommand(cmd);
          }
        }
        return;
      }

      if (e.key === "Backspace" && query === "" && submenu) {
        setSubmenu(null);
        setSelectedIndex(0);
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [submenu, filteredSubmenuItems, filteredCommands, selectedIndex, query, currentItems.length]);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const selected = list.querySelector("[aria-selected='true']");
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const executeCommand = async (cmd: Command) => {
    if (cmd.hasSubmenu && cmd.getSubmenuItems) {
      setSubmenuLoading(true);
      try {
        const items = await cmd.getSubmenuItems();
        setSubmenu({ command: cmd, items });
        setSelectedIndex(0);
        setQuery("");
      } finally {
        setSubmenuLoading(false);
      }
    } else if (cmd.action) {
      addRecentCommand(cmd.id);
      commandPaletteOpen.value = false;
      await cmd.action();
    }
  };

  const executeSubmenuItem = async (item: SubMenuItem) => {
    commandPaletteOpen.value = false;
    if (submenu) {
      addRecentCommand(submenu.command.id);
    }
    await item.action();
  };

  if (!isOpen) return null;

  const handleBackdropKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      commandPaletteOpen.value = false;
    }
  };

  return (
    <div
      class="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] sm:pt-[15vh] animate-fade-in"
      onClick={() => {
        commandPaletteOpen.value = false;
      }}
      onKeyDown={handleBackdropKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label={t("commandPalette.placeholder")}
    >
      {/* Backdrop */}
      <div class="absolute inset-0 bg-black/40 backdrop-blur-md" aria-hidden="true" />

      {/* Palette */}
      <div
        class="relative w-full max-w-xl mx-4 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl shadow-soft-xl overflow-hidden animate-scale-in"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div class="p-3 border-b border-[var(--color-border)]">
          <div class="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-border)] shadow-soft-sm transition-all duration-200">
            <span class="text-[var(--color-text-muted)]" aria-hidden="true">
              {submenu ? "→" : "⌘"}
            </span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
              placeholder={
                submenu ? `${submenu.command.label}...` : t("commandPalette.placeholder")
              }
              class="flex-1 bg-transparent text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] selection:bg-[var(--color-accent)]/20 caret-[var(--color-accent)]"
              style={{ border: "none", outline: "none", boxShadow: "none" }}
              autoComplete="off"
              autoCorrect="off"
              spellcheck={false}
              role="combobox"
              aria-expanded="true"
              aria-controls="command-list"
              aria-activedescendant={selectedItemId}
            />
            {submenuLoading && (
              <span class="text-[var(--color-text-muted)] text-sm">{t("common.loading")}</span>
            )}
          </div>
        </div>

        {/* Command list */}
        <div
          ref={listRef}
          id="command-list"
          class="max-h-[60vh] overflow-y-auto p-2"
          role="listbox"
          aria-label={submenu ? submenu.command.label : t("commandPalette.placeholder")}
        >
          {submenu ? (
            // Submenu items (filtered)
            <div>
              {filteredSubmenuItems.length === 0 ? (
                <div class="px-3 py-8 text-center text-[var(--color-text-muted)]">
                  {query ? t("commandPalette.noMatches") : t("common.noItems")}
                </div>
              ) : (
                filteredSubmenuItems.map((item, idx) => (
                  <button
                    key={item.id}
                    id={`cmd-sub-${item.id}`}
                    role="option"
                    aria-selected={idx === selectedIndex}
                    onClick={() => executeSubmenuItem(item)}
                    class={getItemClass(idx === selectedIndex)}
                  >
                    <span
                      class={`flex-1 ${item.isActive ? "text-[var(--color-accent)] font-medium" : "text-[var(--color-text-primary)]"}`}
                    >
                      {item.label}
                    </span>
                    {item.description && (
                      <span class="text-sm text-[var(--color-text-muted)]">{item.description}</span>
                    )}
                    {item.isActive && (
                      <span class="text-[var(--color-accent)]" aria-hidden="true">
                        ✓
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          ) : query ? (
            // Flat filtered list
            <div>
              {filteredCommands.length === 0 ? (
                <div class="px-3 py-8 text-center text-[var(--color-text-muted)]">
                  {t("commandPalette.noCommands")}
                </div>
              ) : (
                filteredCommands.map((cmd, idx) => (
                  <CommandItem
                    key={cmd.id}
                    command={cmd}
                    isSelected={idx === selectedIndex}
                    onClick={() => executeCommand(cmd)}
                  />
                ))
              )}
            </div>
          ) : (
            // Grouped by category
            <div>
              {groupedCommands &&
                groupedCommands.map((group) => (
                  <div key={group.category} class="mb-2">
                    <div class="px-3 py-1 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                      {group.label}
                    </div>
                    {group.commands.map((cmd) => {
                      const globalIdx = filteredCommands.indexOf(cmd);
                      return (
                        <CommandItem
                          key={cmd.id}
                          command={cmd}
                          isSelected={globalIdx === selectedIndex}
                          onClick={() => executeCommand(cmd)}
                        />
                      );
                    })}
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Footer hints */}
        <div class="flex items-center gap-4 px-4 py-2 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-xs text-[var(--color-text-muted)]">
          <span>{t("commandPalette.hints.navigate")}</span>
          <span>{t("commandPalette.hints.select")}</span>
          <span>{submenu ? t("commandPalette.hints.back") : t("commandPalette.hints.close")}</span>
        </div>
      </div>
    </div>
  );
}

interface CommandItemProps {
  command: Command;
  isSelected: boolean;
  onClick: () => void;
}

function CommandItem({ command, isSelected, onClick }: CommandItemProps) {
  const value = command.getValue?.();

  return (
    <button
      id={`cmd-${command.id}`}
      role="option"
      aria-selected={isSelected}
      onClick={onClick}
      class={getItemClass(isSelected)}
    >
      {command.icon && (
        <span class="w-5 text-center" aria-hidden="true">
          {command.icon}
        </span>
      )}
      <span class="flex-1 text-[var(--color-text-primary)]">{command.label}</span>
      {value && <span class="text-sm text-[var(--color-text-muted)]">{value}</span>}
      {command.hasSubmenu && (
        <span class="text-[var(--color-text-muted)]" aria-hidden="true">
          →
        </span>
      )}
      {command.shortcut && !command.hasSubmenu && (
        <span class="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] px-1.5 py-0.5 rounded">
          {command.shortcut}
        </span>
      )}
    </button>
  );
}

/**
 * Group commands by category, with recent items first
 */
function groupByCategory(commands: Command[], recentIds: string[]) {
  const groups: Array<{
    category: CommandCategory | "recent";
    label: string;
    commands: Command[];
  }> = [];

  // Recent group
  const recent = commands.filter((c) => recentIds.includes(c.id));
  if (recent.length > 0) {
    groups.push({ category: "recent", label: getCategoryLabel("recent"), commands: recent });
  }

  // Category groups
  const nonRecent = commands.filter((c) => !recentIds.includes(c.id));
  for (const category of CATEGORY_ORDER) {
    const categoryCommands = nonRecent.filter((c) => c.category === category);
    if (categoryCommands.length > 0) {
      groups.push({
        category,
        label: getCategoryLabel(category),
        commands: categoryCommands,
      });
    }
  }

  return groups;
}
