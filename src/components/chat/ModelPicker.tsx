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

import { useState, useRef, useEffect } from "preact/hooks";
import { models, modelsByProvider, getModelDisplayName } from "@/signals/models";
import { send } from "@/lib/gateway";
import { log } from "@/lib/logger";
import { ChevronDownIcon } from "@/components/ui";

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
  const menuRef = useRef<HTMLDivElement>(null);

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
  log.ui.debug("ModelPicker state:", {
    modelsCount: models.value.length,
    currentModel,
    firstModel: models.value[0]?.id,
    providers: Array.from(modelsByProvider.value.keys()),
  });

  // Don't render if no models available
  if (models.value.length === 0) {
    log.ui.debug("ModelPicker: no models loaded, hiding");
    return null;
  }

  // Filter to current provider only (workaround for OpenClaw showing all models)
  // If no currentModel (using default), fall back to first model's provider
  const effectiveModel = currentModel ?? models.value[0]?.id;
  const currentProvider = getProviderFromModelId(effectiveModel ?? "");
  const availableModels = currentProvider
    ? (modelsByProvider.value.get(currentProvider) ?? [])
    : [];

  log.ui.debug("ModelPicker filtering:", {
    effectiveModel,
    currentProvider,
    availableModelsCount: availableModels.length,
  });

  // Don't render if no models for this provider
  if (availableModels.length === 0) {
    log.ui.debug("ModelPicker: no models for provider, hiding");
    return null;
  }

  const displayName = currentModel ? getModelDisplayName(currentModel) : "Default";

  const handleSelect = async (modelId: string) => {
    if (modelId === currentModel) {
      setOpen(false);
      return;
    }

    setUpdating(true);
    try {
      await send("sessions.patch", {
        key: sessionKey,
        model: modelId,
      });
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
          {availableModels.map((model) => (
            <button
              key={model.id}
              type="button"
              onClick={() => handleSelect(model.id)}
              class={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                currentModel === model.id
                  ? "text-[var(--color-accent)] bg-[var(--color-accent)]/10"
                  : "text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]"
              }`}
            >
              <span class="truncate">{model.name}</span>
              {model.reasoning && (
                <span class="text-[10px] text-[var(--color-warning)] ml-2">🧠</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
