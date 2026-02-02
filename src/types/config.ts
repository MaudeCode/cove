/**
 * Config Types
 *
 * Types for the schema-driven configuration editor.
 */

// ============================================
// JSON Schema Types (subset we need)
// ============================================

export interface JsonSchema {
  type?: string | string[];
  title?: string;
  description?: string;
  default?: unknown;
  const?: unknown;
  enum?: unknown[];
  format?: string;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  items?: JsonSchema;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  nullable?: boolean;
  $ref?: string;
}

// ============================================
// UI Hint Types
// ============================================

export interface ConfigUiHint {
  label?: string;
  help?: string;
  group?: string;
  order?: number;
  advanced?: boolean;
  sensitive?: boolean;
  placeholder?: string;
  itemTemplate?: unknown;
}

export type ConfigUiHints = Record<string, ConfigUiHint>;

// ============================================
// Config API Response Types
// ============================================

/** Response from config.get */
export interface ConfigGetResponse {
  raw: string;
  config: Record<string, unknown>;
  valid: boolean;
  exists: boolean;
  hash?: string;
  path?: string;
}

/** Response from config.schema */
export interface ConfigSchemaResponse {
  schema: JsonSchema;
  uiHints: ConfigUiHints;
  version: string;
  generatedAt: string;
}

/** Response from config.patch/config.apply */
export interface ConfigSaveResponse {
  ok: boolean;
  path: string;
  config: Record<string, unknown>;
  restart?: {
    scheduled: boolean;
    delayMs?: number;
  };
  sentinel?: {
    path: string | null;
    payload: unknown;
  };
}
