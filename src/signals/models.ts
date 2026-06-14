/**
 * Models Signals
 *
 * Available model choices from the gateway.
 *
 * OpenClaw 2026.5+ supports a configured catalog view, so Cove asks the
 * gateway for models backed by active credentials.
 */

import { signal, computed } from "@preact/signals";
import { send } from "@/lib/gateway";
import { log } from "@/lib/logger";
import type { ModelChoice } from "@/types/models";

const STATUS_UNAVAILABLE = Symbol("status unavailable");

// ============================================
// State
// ============================================

/** Available models from the gateway */
export const models = signal<ModelChoice[]>([]);

/** Default model from gateway status (e.g., "anthropic/claude-opus-4-5") */
export const defaultModel = signal<string | null>(null);

/** Whether we're loading models */
const isLoadingModels = signal<boolean>(false);

/** Error from loading models */
const modelsError = signal<string | null>(null);

// ============================================
// Derived State
// ============================================

/** Models grouped by provider */
export const modelsByProvider = computed(() => {
  const grouped = new Map<string, ModelChoice[]>();

  for (const model of models.value) {
    const provider = model.provider;
    if (!grouped.has(provider)) {
      grouped.set(provider, []);
    }
    grouped.get(provider)!.push(model);
  }

  return grouped;
});

// ============================================
// Actions
// ============================================

/**
 * Load available models from the gateway
 */
export async function loadModels(): Promise<void> {
  isLoadingModels.value = true;
  modelsError.value = null;

  try {
    // Load models list and default model in parallel
    const [modelsResult, statusResult] = await Promise.all([
      send("models.list", { view: "configured" }),
      send("status", {}).catch(() => STATUS_UNAVAILABLE), // Don't fail if status unavailable
    ]);

    models.value = modelsResult.models ?? [];
    log.ui.debug("Loaded models:", models.value.length);

    // Extract default model from status
    if (statusResult !== STATUS_UNAVAILABLE) {
      const status =
        statusResult && typeof statusResult === "object"
          ? (statusResult as { sessions?: { defaults?: { model?: unknown } } })
          : null;
      const defaultModelValue = status?.sessions?.defaults?.model;
      defaultModel.value = typeof defaultModelValue === "string" ? defaultModelValue : null;
      if (defaultModel.value) {
        log.ui.debug("Default model:", defaultModel.value);
      }
    }
  } catch (err) {
    modelsError.value = err instanceof Error ? err.message : String(err);
    log.ui.error("Failed to load models:", err);
  } finally {
    isLoadingModels.value = false;
  }
}

/**
 * Find a model by ID
 */
function findModel(modelId: string): ModelChoice | undefined {
  return models.value.find((m) => m.id === modelId);
}

/**
 * Get a short display name for a model
 */
export function getModelDisplayName(modelId: string): string {
  const model = findModel(modelId);
  if (model) return model.name;

  // Fallback: shorten the ID
  return modelId
    .replace(/^anthropic\//, "")
    .replace(/^openai\//, "")
    .replace(/^claude-/, "")
    .replace(/^gpt-/, "");
}
