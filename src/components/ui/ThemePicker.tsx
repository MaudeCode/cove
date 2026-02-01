/**
 * ThemePicker
 *
 * Icon button with dropdown grid for theme selection.
 * Shows color swatches for quick visual selection.
 */

import { useState, useRef } from "preact/hooks";
import { Palette, Check, Monitor } from "lucide-preact";
import { themePreference, setTheme, getAllThemes } from "@/lib/theme";
import { useClickOutside } from "@/hooks";
import { IconButton } from "./IconButton";
import { Tooltip } from "./Tooltip";
import { t } from "@/lib/i18n";
import type { Theme } from "@/types/theme";

/** Theme swatch button */
function ThemeSwatch({
  theme,
  isSelected,
  onClick,
}: {
  theme: Theme;
  isSelected: boolean;
  onClick: () => void;
}) {
  const bgColor = theme.colors["--color-bg-primary"];
  const accentColor = theme.colors["--color-accent"];

  return (
    <Tooltip content={theme.name} placement="top" delay={200}>
      <button
        type="button"
        onClick={onClick}
        class={`
          relative w-9 h-9 rounded-lg border-2 transition-all
          hover:scale-110 hover:z-10
          focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-1
          ${isSelected ? "border-[var(--color-accent)] ring-2 ring-[var(--color-accent)] ring-offset-1" : "border-[var(--color-border)] hover:border-[var(--color-border-hover)]"}
        `}
        style={{ backgroundColor: bgColor }}
      >
        {/* Accent color indicator */}
        <span
          class="absolute bottom-1 right-1 w-3 h-3 rounded-full border border-white/20"
          style={{ backgroundColor: accentColor }}
        />
        {/* Check mark for selected */}
        {isSelected && (
          <span class="absolute inset-0 flex items-center justify-center">
            <Check class="w-4 h-4 text-[var(--color-accent)]" strokeWidth={3} />
          </span>
        )}
      </button>
    </Tooltip>
  );
}

export function ThemePicker() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const themes = getAllThemes();
  const pref = themePreference.value;
  const currentValue = pref.selected;

  // Group themes by appearance
  const lightThemes = themes.filter((t) => t.appearance === "light");
  const darkThemes = themes.filter((t) => t.appearance === "dark");

  const close = () => setIsOpen(false);

  useClickOutside(containerRef, close, isOpen);

  const selectTheme = (themeId: string) => {
    setTheme(themeId);
    close();
  };

  return (
    <div class="relative" ref={containerRef}>
      <IconButton
        icon={<Palette class="w-5 h-5" />}
        label={t("settings.appearance.theme")}
        onClick={() => setIsOpen(!isOpen)}
        variant="ghost"
        size="md"
      />

      {isOpen && (
        <div class="absolute top-full right-0 mt-1 z-50 w-[260px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] shadow-lg overflow-hidden">
          {/* System option */}
          <div class="p-2 border-b border-[var(--color-border)]">
            <button
              type="button"
              onClick={() => selectTheme("system")}
              class={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
                ${currentValue === "system" ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]" : "hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]"}`}
            >
              <Monitor class="w-4 h-4" />
              <span class="flex-1 text-left">{t("settings.appearance.themeSystem")}</span>
              {currentValue === "system" && <Check class="w-4 h-4" />}
            </button>
          </div>

          {/* Theme grid - scrollable */}
          <div class="max-h-[340px] overflow-y-auto">
            {/* Light themes */}
            <div class="p-3 border-b border-[var(--color-border)]">
              <div class="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
                {t("settings.appearance.lightThemes")}
              </div>
              <div class="grid grid-cols-5 gap-2">
                {lightThemes.map((theme) => (
                  <ThemeSwatch
                    key={theme.id}
                    theme={theme}
                    isSelected={currentValue === theme.id}
                    onClick={() => selectTheme(theme.id)}
                  />
                ))}
              </div>
            </div>

            {/* Dark themes */}
            <div class="p-3">
              <div class="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
                {t("settings.appearance.darkThemes")}
              </div>
              <div class="grid grid-cols-5 gap-2">
                {darkThemes.map((theme) => (
                  <ThemeSwatch
                    key={theme.id}
                    theme={theme}
                    isSelected={currentValue === theme.id}
                    onClick={() => selectTheme(theme.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
