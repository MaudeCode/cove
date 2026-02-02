/**
 * Config Signals
 *
 * State management for the configuration editor.
 */

import { signal, computed } from "@preact/signals";
import { send } from "@/lib/gateway";
import { getErrorMessage } from "@/lib/session-utils";
import type {
  JsonSchema,
  ConfigUiHints,
  ConfigGetResponse,
  ConfigSchemaResponse,
  ConfigSaveResponse,
  ConfigSection,
} from "@/types/config";
import { CONFIG_GROUPS } from "@/types/config";
import { extractFields, groupFieldsIntoSections, setValueAtPath } from "@/lib/config/schema-utils";

// ============================================
// Core State
// ============================================

/** Loading state */
export const isLoading = signal(false);

/** Error message */
export const error = signal<string | null>(null);

/** Saving state */
export const isSaving = signal(false);

/** JSON Schema from gateway */
export const schema = signal<JsonSchema | null>(null);

/** UI hints from gateway */
export const uiHints = signal<ConfigUiHints>({});

/** Original config (as loaded) */
export const originalConfig = signal<Record<string, unknown>>({});

/** Draft config (with user edits) */
export const draftConfig = signal<Record<string, unknown>>({});

/** Content hash for optimistic locking */
export const baseHash = signal<string | null>(null);

/** Config file path */
export const configPath = signal<string | null>(null);

/** Whether config exists on disk */
export const configExists = signal(false);

/** Whether config is valid */
export const configValid = signal(true);

/** OpenClaw version from schema */
export const schemaVersion = signal<string | null>(null);

// ============================================
// UI State
// ============================================

/** Search query for filtering */
export const searchQuery = signal("");

/** Show advanced settings */
export const showAdvanced = signal(false);

/** Expanded section IDs */
export const expandedSections = signal<Set<string>>(new Set(["gateway", "agents", "channels"]));

/** Validation errors by path */
export const validationErrors = signal<Record<string, string>>({});

// ============================================
// Computed State
// ============================================

/** Whether there are unsaved changes */
export const isDirty = computed(() => {
  return JSON.stringify(originalConfig.value) !== JSON.stringify(draftConfig.value);
});

/** All fields extracted from schema */
export const allFields = computed(() => {
  if (!schema.value) return [];
  return extractFields(schema.value, draftConfig.value, uiHints.value);
});

/** Fields grouped into sections */
export const sections = computed((): ConfigSection[] => {
  const fields = allFields.value;
  if (fields.length === 0) return [];

  // Filter by search query
  const query = searchQuery.value.toLowerCase().trim();
  let filtered = fields;

  if (query) {
    filtered = fields.filter((f) => {
      const label = f.hint.label ?? f.key;
      const help = f.hint.help ?? "";
      return (
        f.key.toLowerCase().includes(query) ||
        label.toLowerCase().includes(query) ||
        help.toLowerCase().includes(query)
      );
    });
  }

  // Filter by advanced
  if (!showAdvanced.value) {
    filtered = filtered.filter((f) => !f.hint.advanced);
  }

  return groupFieldsIntoSections(filtered, CONFIG_GROUPS);
});

/** Whether we can save */
export const canSave = computed(() => {
  return isDirty.value && !isSaving.value && Object.keys(validationErrors.value).length === 0;
});

// ============================================
// Actions
// ============================================

/** Load config and schema from gateway */
export async function loadConfig(): Promise<void> {
  isLoading.value = true;
  error.value = null;

  try {
    // Load config and schema in parallel
    const [configRes, schemaRes] = await Promise.all([
      send<ConfigGetResponse>("config.get", {}),
      send<ConfigSchemaResponse>("config.schema", {}),
    ]);

    // Store schema
    schema.value = schemaRes.schema;
    uiHints.value = schemaRes.uiHints;
    schemaVersion.value = schemaRes.version;

    // Store config
    originalConfig.value = configRes.config;
    draftConfig.value = structuredClone(configRes.config);
    baseHash.value = configRes.hash ?? null;
    configPath.value = configRes.path ?? null;
    configExists.value = configRes.exists;
    configValid.value = configRes.valid;

    // Clear validation errors
    validationErrors.value = {};
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    isLoading.value = false;
  }
}

/** Update a field value in the draft */
export function updateField(path: (string | number)[], value: unknown): void {
  draftConfig.value = setValueAtPath(draftConfig.value, path, value);
}

/** Reset draft to original */
export function resetDraft(): void {
  draftConfig.value = structuredClone(originalConfig.value);
  validationErrors.value = {};
}

/** Set a validation error for a path */
export function setValidationError(path: string, message: string | null): void {
  const next = { ...validationErrors.value };
  if (message) {
    next[path] = message;
  } else {
    delete next[path];
  }
  validationErrors.value = next;
}

/** Toggle section expansion */
export function toggleSection(sectionId: string): void {
  const next = new Set(expandedSections.value);
  if (next.has(sectionId)) {
    next.delete(sectionId);
  } else {
    next.add(sectionId);
  }
  expandedSections.value = next;
}

/** Save config to gateway */
export async function saveConfig(): Promise<boolean> {
  if (!canSave.value) return false;
  if (!baseHash.value && configExists.value) {
    error.value = "Missing base hash. Reload and try again.";
    return false;
  }

  isSaving.value = true;
  error.value = null;

  try {
    // Build patch (diff between original and draft)
    const patch = buildPatch(originalConfig.value, draftConfig.value);

    const result = await send<ConfigSaveResponse>("config.patch", {
      raw: JSON.stringify(patch),
      baseHash: baseHash.value,
    });

    if (result.ok) {
      // Update state with saved config
      originalConfig.value = result.config;
      draftConfig.value = structuredClone(result.config);
      configPath.value = result.path;

      // Reload to get new hash
      const newConfig = await send<ConfigGetResponse>("config.get", {});
      baseHash.value = newConfig.hash ?? null;

      return true;
    } else {
      error.value = "Failed to save configuration";
      return false;
    }
  } catch (err) {
    const msg = getErrorMessage(err);
    // Check for hash mismatch
    if (msg.includes("hash") || msg.includes("changed")) {
      error.value = "Configuration was modified externally. Please reload.";
    } else {
      error.value = msg;
    }
    return false;
  } finally {
    isSaving.value = false;
  }
}

// ============================================
// Helpers
// ============================================

/** Build a merge patch from original to draft */
function buildPatch(
  original: Record<string, unknown>,
  draft: Record<string, unknown>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  // Find changed/added keys
  for (const key of Object.keys(draft)) {
    const origVal = original[key];
    const draftVal = draft[key];

    if (JSON.stringify(origVal) !== JSON.stringify(draftVal)) {
      if (
        draftVal !== null &&
        typeof draftVal === "object" &&
        !Array.isArray(draftVal) &&
        origVal !== null &&
        typeof origVal === "object" &&
        !Array.isArray(origVal)
      ) {
        // Recursively build nested patch
        patch[key] = buildPatch(
          origVal as Record<string, unknown>,
          draftVal as Record<string, unknown>,
        );
      } else {
        patch[key] = draftVal;
      }
    }
  }

  // Find deleted keys (set to null in merge patch)
  for (const key of Object.keys(original)) {
    if (!(key in draft)) {
      patch[key] = null;
    }
  }

  return patch;
}
