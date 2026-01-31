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

import { useState, useRef, useEffect, useMemo } from "preact/hooks";
import { models, modelsByProvider, getModelDisplayName, defaultModel } from "@/signals/models";
import { send } from "@/lib/gateway";
import { log } from "@/lib/logger";
import { ChevronDownIcon } from "@/components/ui";

const FAVORITES_KEY = "cove:model-favorites";

function loadFavorites(): Set<string> {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function saveFavorites(favorites: Set<string>): void {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
}

interface ModelPickerProps {
  sessionKey: string;
  currentModel?: string;
  onModelChange?: (modelId: string) => void;
}

/**
 * Extract provider from a model ID (e.g., "anthropic" from "anthropic/claude-opus-4-5")
 */
function getProviderFromModelId(modelId: string): string | null {
  if (!modelId) return null;
  const slashIndex = modelId.indexOf("/");
  if (slashIndex === -1) return null;
  return modelId.substring(0, slashIndex);
}

export function ModelPicker({ sessionKey, currentModel, onModelChange }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites());
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleFavorite = (modelId: string, e: MouseEvent) => {
    e.stopPropagation(); // Don't trigger model selection
    const newFavorites = new Set(favorites);
    if (newFavorites.has(modelId)) {
      newFavorites.delete(modelId);
    } else {
      newFavorites.add(modelId);
    }
    setFavorites(newFavorites);
    saveFavorites(newFavorites);
  };

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Debug logging
  console.log("[ModelPicker] state:", {
    modelsCount: models.value.length,
    currentModel,
    firstModel: models.value[0]?.id,
    providers: Array.from(modelsByProvider.value.keys()),
  });

  // Don't render if no models available
  if (models.value.length === 0) {
    console.log("[ModelPicker] no models loaded, hiding");
    return null;
  }

  // Filter to current provider only (workaround for OpenClaw showing all models)
  // Priority: session override > gateway default model > first model in list
  const effectiveModel = currentModel ?? defaultModel.value ?? models.value[0]?.id;
  
  // Try to get provider from model ID (if slash-separated format like "anthropic/claude-opus-4-5")
  let currentProvider = getProviderFromModelId(effectiveModel ?? "");
  
  // If model ID doesn't have provider prefix, find it in the models list
  if (!currentProvider && effectiveModel) {
    const foundModel = models.value.find((m) => m.id === effectiveModel);
    currentProvider = foundModel?.provider ?? null;
  }
  
  // Get models for this provider, dedupe by ID, and sort with current model first, then favorites
  const providerModels = currentProvider
    ? (modelsByProvider.value.get(currentProvider) ?? [])
    : [];
  const dedupedModels = providerModels.filter(
    (model, index, self) => self.findIndex((m) => m.id === model.id) === index,
  );
  const availableModels = useMemo(
    () =>
      [...dedupedModels].sort((a, b) => {
        // Current model always first
        if (a.id === effectiveModel) return -1;
        if (b.id === effectiveModel) return 1;
        // Then favorites
        const aFav = favorites.has(a.id);
        const bFav = favorites.has(b.id);
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;
        // Then alphabetically by name
        return a.name.localeCompare(b.name);
      }),
    [dedupedModels, effectiveModel, favorites],
  );

  console.log("[ModelPicker] filtering:", {
    currentModel,
    defaultModelValue: defaultModel.value,
    effectiveModel,
    currentProvider,
    providerModelsCount: providerModels.length,
    dedupedCount: availableModels.length,
  });

  // Don't render if no models for this provider
  if (availableModels.length === 0) {
    console.log("[ModelPicker] no models for provider, hiding");
    return null;
  }

  const displayName = currentModel ? getModelDisplayName(currentModel) : "Default";

  const handleSelect = async (modelId: string) => {
    console.log("[ModelPicker] selecting:", modelId, "current:", currentModel);
    if (modelId === currentModel) {
      setOpen(false);
      return;
    }

    setUpdating(true);
    try {
      console.log("[ModelPicker] sending sessions.patch:", { key: sessionKey, model: modelId });
      await send("sessions.patch", {
        key: sessionKey,
        model: modelId,
      });
      console.log("[ModelPicker] patch succeeded");
      onModelChange?.(modelId);
      log.ui.debug("Model changed to:", modelId);
    } catch (err) {
      console.error("[ModelPicker] patch failed:", err);
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
              <button
                key={model.id}
                type="button"
                onClick={() => handleSelect(model.id)}
                class={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
                  isCurrent
                    ? "text-[var(--color-accent)] bg-[var(--color-accent)]/10"
                    : "text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]"
                }`}
              >
                {/* Favorite star */}
                <span
                  onClick={(e) => toggleFavorite(model.id, e)}
                  class={`cursor-pointer text-xs transition-colors ${
                    isFavorite
                      ? "text-yellow-500"
                      : "text-[var(--color-text-muted)] hover:text-yellow-400"
                  }`}
                  title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                >
                  {isFavorite ? "★" : "☆"}
                </span>
                <span class="truncate flex-1">{model.name}</span>
                {model.reasoning && (
                  <span class="text-[10px] text-[var(--color-warning)]">🧠</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
