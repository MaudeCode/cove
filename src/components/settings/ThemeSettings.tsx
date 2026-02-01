/**
 * ThemeSettings
 *
 * Full settings page theme picker with:
 * - All themes visible in a grid
 * - System preference toggle
 * - Separate light/dark theme selection when using system
 */

import { Monitor, Sun, Moon, Check } from "lucide-preact";
import { t } from "@/lib/i18n";
import { themePreference, setTheme, setLightTheme, setDarkTheme, getAllThemes } from "@/lib/theme";
import { Toggle, Tooltip } from "@/components/ui";
import type { Theme } from "@/types/theme";

/** Theme swatch button */
function ThemeSwatch({
  theme,
  isSelected,
  onClick,
  size = "md",
}: {
  theme: Theme;
  isSelected: boolean;
  onClick: () => void;
  size?: "sm" | "md";
}) {
  const bgColor = theme.colors["--color-bg-primary"];
  const accentColor = theme.colors["--color-accent"];
  const sizeClasses = size === "sm" ? "w-10 h-10" : "w-12 h-12";
  const accentSize = size === "sm" ? "w-3 h-3" : "w-4 h-4";
  const checkSize = size === "sm" ? "w-4 h-4" : "w-5 h-5";

  return (
    <Tooltip content={theme.name} placement="top" delay={200}>
      <button
        type="button"
        onClick={onClick}
        class={`
          relative ${sizeClasses} rounded-xl border-2 transition-all
          hover:scale-105
          focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2
          ${isSelected ? "border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]" : "border-[var(--color-border)] hover:border-[var(--color-text-muted)]"}
        `}
        style={{ backgroundColor: bgColor }}
        aria-label={theme.name}
        aria-pressed={isSelected}
      >
        {/* Accent color dot */}
        <span
          class={`absolute bottom-1.5 right-1.5 ${accentSize} rounded-full border border-white/30`}
          style={{ backgroundColor: accentColor }}
        />
        {/* Check mark */}
        {isSelected && (
          <span class="absolute inset-0 flex items-center justify-center">
            <Check class={`${checkSize} text-[var(--color-accent)]`} strokeWidth={3} />
          </span>
        )}
      </button>
    </Tooltip>
  );
}

/** Section header with icon */
function SectionHeader({ icon, titleKey }: { icon: preact.ComponentChildren; titleKey: string }) {
  return (
    <div class="flex items-center gap-2 mb-3">
      <span class="text-[var(--color-text-muted)]">{icon}</span>
      <span class="text-sm font-medium text-[var(--color-text-secondary)]">{t(titleKey)}</span>
    </div>
  );
}

export function ThemeSettings() {
  const themes = getAllThemes();
  const pref = themePreference.value;
  const isSystemMode = pref.selected === "system";

  // Group themes
  const lightThemes = themes.filter((t) => t.appearance === "light");
  const darkThemes = themes.filter((t) => t.appearance === "dark");

  // Current selections
  const selectedLightTheme = pref.lightTheme;
  const selectedDarkTheme = pref.darkTheme;
  const selectedManualTheme = pref.selected !== "system" ? pref.selected : null;

  const handleSystemToggle = (enabled: boolean) => {
    if (enabled) {
      setTheme("system");
    } else {
      // Switch to the theme that matches current system preference
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(prefersDark ? selectedDarkTheme : selectedLightTheme);
    }
  };

  const handleThemeSelect = (themeId: string, appearance: "light" | "dark") => {
    if (isSystemMode) {
      // Update the corresponding system theme
      if (appearance === "light") {
        setLightTheme(themeId);
      } else {
        setDarkTheme(themeId);
      }
    } else {
      // Direct theme selection
      setTheme(themeId);
    }
  };

  return (
    <div class="space-y-6">
      {/* System preference toggle */}
      <div class="flex items-center justify-between p-4 rounded-xl bg-[var(--color-bg-secondary)]">
        <div class="flex items-center gap-3">
          <Monitor class="w-5 h-5 text-[var(--color-text-muted)]" />
          <div>
            <p class="text-sm font-medium text-[var(--color-text-primary)]">
              {t("settings.appearance.useSystemTheme")}
            </p>
            <p class="text-xs text-[var(--color-text-muted)]">
              {t("settings.appearance.useSystemThemeDescription")}
            </p>
          </div>
        </div>
        <Toggle checked={isSystemMode} onChange={handleSystemToggle} size="sm" />
      </div>

      {isSystemMode ? (
        /* System mode: show light and dark theme selections */
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Light theme selection */}
          <div>
            <SectionHeader
              icon={<Sun class="w-4 h-4" />}
              titleKey="settings.appearance.lightTheme"
            />
            <div class="grid grid-cols-5 gap-2">
              {lightThemes.map((theme) => (
                <ThemeSwatch
                  key={theme.id}
                  theme={theme}
                  isSelected={selectedLightTheme === theme.id}
                  onClick={() => handleThemeSelect(theme.id, "light")}
                />
              ))}
            </div>
          </div>

          {/* Dark theme selection */}
          <div>
            <SectionHeader
              icon={<Moon class="w-4 h-4" />}
              titleKey="settings.appearance.darkTheme"
            />
            <div class="grid grid-cols-5 gap-2">
              {darkThemes.map((theme) => (
                <ThemeSwatch
                  key={theme.id}
                  theme={theme}
                  isSelected={selectedDarkTheme === theme.id}
                  onClick={() => handleThemeSelect(theme.id, "dark")}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Manual mode: show all themes */
        <div class="space-y-6">
          {/* Light themes */}
          <div>
            <SectionHeader
              icon={<Sun class="w-4 h-4" />}
              titleKey="settings.appearance.lightThemes"
            />
            <div class="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2">
              {lightThemes.map((theme) => (
                <ThemeSwatch
                  key={theme.id}
                  theme={theme}
                  isSelected={selectedManualTheme === theme.id}
                  onClick={() => handleThemeSelect(theme.id, "light")}
                />
              ))}
            </div>
          </div>

          {/* Dark themes */}
          <div>
            <SectionHeader
              icon={<Moon class="w-4 h-4" />}
              titleKey="settings.appearance.darkThemes"
            />
            <div class="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2">
              {darkThemes.map((theme) => (
                <ThemeSwatch
                  key={theme.id}
                  theme={theme}
                  isSelected={selectedManualTheme === theme.id}
                  onClick={() => handleThemeSelect(theme.id, "dark")}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
