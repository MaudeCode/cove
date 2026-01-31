/**
 * ModelPicker
 *
 * Dropdown to select the model for the current session.
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

  // Don't render if no models available
  if (models.value.length === 0) {
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
        sessionKey,
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
          {/* Group by provider */}
          {Array.from(modelsByProvider.value.entries()).map(([provider, providerModels]) => (
            <div key={provider}>
              <div class="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)]">
                {provider}
              </div>
              {providerModels.map((model) => (
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
          ))}
        </div>
      )}
    </div>
  );
}
