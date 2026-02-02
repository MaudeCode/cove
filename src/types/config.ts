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

// ============================================
// Field Types
// ============================================

export type FieldType =
  | "string"
  | "password"
  | "textarea"
  | "url"
  | "number"
  | "toggle"
  | "dropdown"
  | "segmented"
  | "array"
  | "object"
  | "json";

// ============================================
// Section/Group Types
// ============================================

/** A section groups related config fields */
export interface ConfigSection {
  id: string;
  label: string;
  order: number;
  fields: ConfigFieldInfo[];
}

/** Information about a config field */
export interface ConfigFieldInfo {
  path: (string | number)[];
  key: string;
  schema: JsonSchema;
  hint: ConfigUiHint;
  fieldType: FieldType;
  value: unknown;
  defaultValue: unknown;
  required: boolean;
}

// ============================================
// Group Definitions
// ============================================

/** Known config groups with display info */
export const CONFIG_GROUPS: Record<
  string,
  { label: string; icon: string; order: number; description?: string }
> = {
  wizard: { label: "Wizard", icon: "Wand2", order: 20 },
  update: { label: "Updates", icon: "Download", order: 25 },
  diagnostics: { label: "Diagnostics", icon: "Activity", order: 27 },
  gateway: { label: "Gateway", icon: "Globe", order: 30 },
  nodeHost: { label: "Node Host", icon: "Server", order: 35 },
  agents: { label: "Agents", icon: "Bot", order: 40 },
  tools: { label: "Tools", icon: "Wrench", order: 50 },
  bindings: { label: "Bindings", icon: "Link", order: 55 },
  audio: { label: "Audio", icon: "Volume2", order: 60 },
  models: { label: "Models", icon: "Box", order: 70 },
  auth: { label: "Authentication", icon: "Lock", order: 75 },
  messages: { label: "Messages", icon: "MessageSquare", order: 80 },
  commands: { label: "Commands", icon: "Terminal", order: 85 },
  session: { label: "Session", icon: "Users", order: 90 },
  cron: { label: "Cron", icon: "Clock", order: 100 },
  hooks: { label: "Hooks", icon: "Webhook", order: 110 },
  ui: { label: "UI", icon: "Layout", order: 120 },
  browser: { label: "Browser", icon: "Chrome", order: 130 },
  talk: { label: "Talk", icon: "Mic", order: 140 },
  channels: { label: "Channels", icon: "Radio", order: 150, description: "Messaging integrations" },
  skills: { label: "Skills", icon: "Sparkles", order: 200 },
  plugins: { label: "Plugins", icon: "Puzzle", order: 205 },
  discovery: { label: "Discovery", icon: "Search", order: 210 },
  presence: { label: "Presence", icon: "Eye", order: 220 },
  voicewake: { label: "Voice Wake", icon: "Mic2", order: 230 },
  logging: { label: "Logging", icon: "FileText", order: 900 },
  meta: { label: "Metadata", icon: "Info", order: 999 },
};
