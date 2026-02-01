/**
 * ModelPicker
 *
 * Dropdown to select the model for the current session.
 *
 * WORKAROUND: We filter to only show models from the current provider because
 * OpenClaw's models.list returns ALL known models, not just authenticated ones.
 * This prevents users from seeing (and failing to use) models they don't have
 * auth for. Proper fix belongs in OpenClaw's loadModelCatalog().
 *
 * @see src/signals/models.ts for details
 */

import { useState, useRef, useMemo } from "preact/hooks";
import { models, modelsByProvider, getModelDisplayName, defaultModel } from "@/signals/models";
import { send } from "@/lib/gateway";
import { log } from "@/lib/logger";
import { t } from "@/lib/i18n";
import { useClickOutside } from "@/hooks/useClickOutside";
import { ChevronDownIcon } from "@/components/ui/icons";

const FAVORITES_KEY = "cove:model-favorites";

/** Load favorite model IDs from localStorage */
function loadFavorites(): Set<string> {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

/** Save favorite model IDs to localStorage */
function saveFavorites(favorites: Set<string>): void {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
}

/**
 * Extract provider from a model ID (e.g., "anthropic" from "anthropic/claude-opus-4-5")
 * Returns null if no slash separator found.
 */
function getProviderFromModelId(modelId: string): string | null {
  if (!modelId) return null;
  const slashIndex = modelId.indexOf("/");
  return slashIndex === -1 ? null : modelId.substring(0, slashIndex);
}

/**
 * Resolve the provider for a model ID.
 * First tries slash-separated format, then looks up in models list.
 */
function resolveProvider(modelId: string | undefined): string | null {
  if (!modelId) return null;

  // Try slash-separated format first (e.g., "anthropic/claude-opus-4-5")
  const fromId = getProviderFromModelId(modelId);
  if (fromId) return fromId;

  // Look up in models list
  const found = models.value.find((m) => m.id === modelId);
  return found?.provider ?? null;
}

interface ModelPickerProps {
  sessionKey: string;
  currentModel?: string;
  onModelChange?: (modelId: string) => void;
}

export function ModelPicker({ sessionKey, currentModel, onModelChange }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites());
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useClickOutside(menuRef, () => setOpen(false), open);

  // Don't render if no models available
  if (models.value.length === 0) {
    return null;
  }

  // Determine effective model: session override > gateway default > first in list
  const effectiveModel = currentModel ?? defaultModel.value ?? models.value[0]?.id;
  const currentProvider = resolveProvider(effectiveModel);

  // Get models for this provider, dedupe, and sort
  const providerModels = currentProvider ? (modelsByProvider.value.get(currentProvider) ?? []) : [];

  const availableModels = useMemo(() => {
    // Dedupe by ID
    const deduped = providerModels.filter(
      (model, index, self) => self.findIndex((m) => m.id === model.id) === index,
    );

    // Sort: current first, then favorites, then alphabetically
    return [...deduped].sort((a, b) => {
      if (a.id === effectiveModel) return -1;
      if (b.id === effectiveModel) return 1;
      const aFav = favorites.has(a.id);
      const bFav = favorites.has(b.id);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [providerModels, effectiveModel, favorites]);

  // Don't render if no models for this provider
  if (availableModels.length === 0) {
    return null;
  }

  const displayName = currentModel ? getModelDisplayName(currentModel) : t("sessions.defaultModel");

  const toggleFavorite = (modelId: string, e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    const newFavorites = new Set(favorites);
    if (newFavorites.has(modelId)) {
      newFavorites.delete(modelId);
    } else {
      newFavorites.add(modelId);
    }
    setFavorites(newFavorites);
    saveFavorites(newFavorites);
  };

  const handleSelect = async (modelId: string) => {
    if (modelId === currentModel) {
      setOpen(false);
      return;
    }

    setUpdating(true);
    try {
      await send("sessions.patch", { key: sessionKey, model: modelId });
      onModelChange?.(modelId);
      log.ui.debug("Model changed to:", modelId);
    } catch (err) {
      log.ui.error("Failed to change model:", err);
    } finally {
      setUpdating(false);
      setOpen(false);
    }
  };

  return (
    <div ref={menuRef} class="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={updating}
        class="flex items-center gap-1 px-2 py-1 rounded-lg text-xs
          text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]
          hover:bg-[var(--color-bg-secondary)] transition-colors
          disabled:opacity-50"
      >
        <span class="max-w-[120px] truncate">{displayName}</span>
        <ChevronDownIcon class="w-3 h-3" open={open} />
      </button>

      {open && (
        <div class="absolute bottom-full left-0 mb-1 w-56 max-h-64 overflow-y-auto bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg shadow-lg z-50">
          {availableModels.map((model) => {
            const isFavorite = favorites.has(model.id);
            const isCurrent = (currentModel ?? effectiveModel) === model.id;
            return (
              <div
                key={model.id}
                class={`flex items-center gap-1 px-2 py-2 transition-colors ${
                  isCurrent
                    ? "text-[var(--color-accent)] bg-[var(--color-accent)]/10"
                    : "text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]"
                }`}
              >
                {/* Favorite star - separate button, not nested */}
                <button
                  type="button"
                  onClick={(e) => toggleFavorite(model.id, e)}
                  class={`p-1 -m-1 text-xs transition-colors rounded hover:bg-[var(--color-bg-tertiary)] ${
                    isFavorite
                      ? "text-[var(--color-warning)]"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-warning)]/70"
                  }`}
                  title={isFavorite ? t("models.removeFavorite") : t("models.addFavorite")}
                  aria-label={isFavorite ? t("models.removeFavorite") : t("models.addFavorite")}
                >
                  {isFavorite ? "★" : "☆"}
                </button>
                {/* Model selection button */}
                <button
                  type="button"
                  onClick={() => handleSelect(model.id)}
                  class="flex-1 text-left text-sm flex items-center gap-2 min-w-0"
                >
                  <span class="truncate">{model.name}</span>
                  {model.reasoning && (
                    <span class="text-[10px] text-[var(--color-warning)] flex-shrink-0">🧠</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
