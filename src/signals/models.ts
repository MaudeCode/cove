/**
 * Models Signals
 *
 * Available model choices from the gateway.
 *
 * KNOWN ISSUE: OpenClaw's models.list returns ALL known models, not just those
 * the user has auth for. This is a bug in OpenClaw's loadModelCatalog() which
 * should filter by hasAuthForProvider().
 *
 * WORKAROUND: ModelPicker filters to only show models from the current session's
 * provider. This prevents users from seeing models they can't use.
 *
 * PROPER FIX: In openclaw/src/agents/model-catalog.ts, filter the catalog to
 * only include models where the provider has valid auth (env key or profile).
 */

import { signal, computed } from "@preact/signals";
import { send } from "@/lib/gateway";
import { log } from "@/lib/logger";
import type { ModelChoice, ModelsListResult } from "@/types/models";

// ============================================
// State
// ============================================

/** Available models from the gateway */
export const models = signal<ModelChoice[]>([]);

/** Whether we're loading models */
export const isLoadingModels = signal<boolean>(false);

/** Error from loading models */
export const modelsError = signal<string | null>(null);

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

/** List of providers */
export const providers = computed(() => Array.from(modelsByProvider.value.keys()).sort());

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
    const result = await send<ModelsListResult>("models.list", {});
    models.value = result.models ?? [];
    log.ui.debug("Loaded models:", models.value.length);
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
export function findModel(modelId: string): ModelChoice | undefined {
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
