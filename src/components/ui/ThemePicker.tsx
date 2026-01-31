/**
 * ThemePicker
 *
 * Icon button with dropdown for theme selection.
 */

import { useState, useRef, useEffect, useCallback } from "preact/hooks";
import { Palette, Check, Monitor } from "lucide-preact";
import { themePreference, setTheme, getAllThemes } from "@/lib/theme";
import { IconButton } from "./IconButton";
import { t } from "@/lib/i18n";

export function ThemePicker() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const themes = getAllThemes();
  const pref = themePreference.value;
  const currentValue = pref.selected;

  // Group themes by appearance
  const lightThemes = themes.filter((t) => t.appearance === "light");
  const darkThemes = themes.filter((t) => t.appearance === "dark");

  const close = useCallback(() => setIsOpen(false), []);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, close]);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, close]);

  const selectTheme = (themeId: string) => {
    setTheme(themeId);
    close();
  };

  return (
    <div class="relative">
      <IconButton
        ref={buttonRef}
        icon={<Palette class="w-5 h-5" />}
        label={t("settings.appearance.theme")}
        onClick={() => setIsOpen(!isOpen)}
        variant="ghost"
        size="md"
      />

      {isOpen && (
        <div
          ref={dropdownRef}
          class="absolute top-full right-0 mt-1 z-50 min-w-[180px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] shadow-lg overflow-hidden"
        >
          {/* System option */}
          <div class="p-1 border-b border-[var(--color-border)]">
            <button
              type="button"
              onClick={() => selectTheme("system")}
              class={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors
                ${currentValue === "system" ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]" : "hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]"}`}
            >
              <Monitor class="w-4 h-4" />
              <span class="flex-1 text-left">{t("settings.appearance.themeSystem")}</span>
              {currentValue === "system" && <Check class="w-4 h-4" />}
            </button>
          </div>

          {/* Light themes */}
          <div class="p-1 border-b border-[var(--color-border)]">
            <div class="px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
              {t("settings.appearance.lightThemes")}
            </div>
            {lightThemes.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => selectTheme(theme.id)}
                class={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors
                  ${currentValue === theme.id ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]" : "hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]"}`}
              >
                <span
                  class="w-4 h-4 rounded-full border border-[var(--color-border)]"
                  style={{ backgroundColor: theme.colors["--color-bg-primary"] }}
                />
                <span class="flex-1 text-left">{theme.name}</span>
                {currentValue === theme.id && <Check class="w-4 h-4" />}
              </button>
            ))}
          </div>

          {/* Dark themes */}
          <div class="p-1">
            <div class="px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
              {t("settings.appearance.darkThemes")}
            </div>
            {darkThemes.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => selectTheme(theme.id)}
                class={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors
                  ${currentValue === theme.id ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]" : "hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]"}`}
              >
                <span
                  class="w-4 h-4 rounded-full border border-[var(--color-border)]"
                  style={{ backgroundColor: theme.colors["--color-bg-primary"] }}
                />
                <span class="flex-1 text-left">{theme.name}</span>
                {currentValue === theme.id && <Check class="w-4 h-4" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
