/**
 * Config Schema Utilities
 *
 * Helpers for working with JSON Schema and UI hints.
 */

import type {
  JsonSchema,
  ConfigUiHint,
  ConfigUiHints,
  FieldType,
  ConfigSection,
  ConfigFieldInfo,
  CONFIG_GROUPS,
} from "@/types/config";

// ============================================
// Path Utilities
// ============================================

/** Convert path array to dot-separated string */
export function pathToKey(path: (string | number)[]): string {
  return path.join(".");
}

/** Get nested value from object by path */
export function getValueAtPath(obj: Record<string, unknown>, path: (string | number)[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string | number, unknown>)[key];
  }
  return current;
}

/** Set nested value in object by path (returns new object) */
export function setValueAtPath(
  obj: Record<string, unknown>,
  path: (string | number)[],
  value: unknown,
): Record<string, unknown> {
  if (path.length === 0) return obj;

  const result = { ...obj };
  let current: Record<string, unknown> = result;

  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    const next = current[key];
    if (next === null || next === undefined || typeof next !== "object") {
      // Create intermediate object or array based on next key
      current[key] = typeof path[i + 1] === "number" ? [] : {};
    } else {
      current[key] = Array.isArray(next) ? [...next] : { ...next };
    }
    current = current[key] as Record<string, unknown>;
  }

  const lastKey = path[path.length - 1];
  if (value === undefined) {
    delete current[lastKey];
  } else {
    current[lastKey] = value;
  }

  return result;
}

// ============================================
// Schema Type Resolution
// ============================================

/** Get the primary type from a schema */
export function schemaType(schema: JsonSchema): string | null {
  if (!schema) return null;

  // Direct type
  if (typeof schema.type === "string") return schema.type;
  if (Array.isArray(schema.type)) {
    const nonNull = schema.type.filter((t) => t !== "null");
    return nonNull[0] ?? null;
  }

  // Const/enum implies type
  if (schema.const !== undefined) return typeof schema.const;
  if (schema.enum && schema.enum.length > 0) return typeof schema.enum[0];

  // anyOf/oneOf - try to resolve
  if (schema.anyOf || schema.oneOf) {
    const variants = schema.anyOf ?? schema.oneOf ?? [];
    const nonNull = variants.filter(
      (v) => v.type !== "null" && !(Array.isArray(v.type) && v.type.includes("null")),
    );
    if (nonNull.length === 1) return schemaType(nonNull[0]);
  }

  return null;
}

/** Determine the field type to render for a schema */
export function resolveFieldType(schema: JsonSchema, hint?: ConfigUiHint): FieldType {
  // Sensitive fields always get password input
  if (hint?.sensitive) return "password";

  // Enum with few options → segmented, many → dropdown
  if (schema.enum) {
    return schema.enum.length <= 5 ? "segmented" : "dropdown";
  }

  // anyOf/oneOf with all literals → segmented/dropdown
  if (schema.anyOf || schema.oneOf) {
    const variants = schema.anyOf ?? schema.oneOf ?? [];
    const literals = variants
      .filter((v) => v.type !== "null")
      .map((v) => v.const ?? (v.enum?.length === 1 ? v.enum[0] : undefined))
      .filter((v) => v !== undefined);

    if (
      literals.length > 0 &&
      literals.length === variants.filter((v) => v.type !== "null").length
    ) {
      return literals.length <= 5 ? "segmented" : "dropdown";
    }
  }

  const type = schemaType(schema);

  switch (type) {
    case "boolean":
      return "toggle";

    case "number":
    case "integer":
      return "number";

    case "string":
      if (schema.format === "uri" || schema.format === "url") return "url";
      if ((schema.maxLength ?? 0) > 200) return "textarea";
      return "string";

    case "array":
      return "array";

    case "object":
      return "object";

    default:
      return "json";
  }
}

/** Get default value from schema */
export function schemaDefault(schema: JsonSchema): unknown {
  if (schema.default !== undefined) return schema.default;
  if (schema.const !== undefined) return schema.const;

  const type = schemaType(schema);
  switch (type) {
    case "boolean":
      return false;
    case "number":
    case "integer":
      return 0;
    case "string":
      return "";
    case "array":
      return [];
    case "object":
      return {};
    default:
      return undefined;
  }
}

// ============================================
// UI Hint Resolution
// ============================================

/** Get hint for a path, checking wildcards */
export function hintForPath(
  path: (string | number)[],
  hints: ConfigUiHints,
): ConfigUiHint | undefined {
  const key = pathToKey(path);

  // Exact match
  if (hints[key]) return hints[key];

  // Try wildcards: agents.list.*.tools → agents.list[].tools
  const wildcardKeys = [
    key.replace(/\.\d+\./g, ".*."),
    key.replace(/\.\d+\./g, "[]."),
    key.replace(/\[\d+\]/g, "[*]"),
  ];

  for (const wk of wildcardKeys) {
    if (hints[wk]) return hints[wk];
  }

  return undefined;
}

/** Humanize a path segment into a label */
export function humanize(key: string | number): string {
  if (typeof key === "number") return `#${key + 1}`;

  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2") // camelCase → Camel Case
    .replace(/[_-]/g, " ") // snake_case/kebab-case → spaces
    .replace(/\b\w/g, (c) => c.toUpperCase()); // Capitalize words
}

// ============================================
// Section Grouping
// ============================================

/** Determine which group a field belongs to */
export function resolveGroup(path: (string | number)[], hint?: ConfigUiHint): string {
  // Explicit group from hint
  if (hint?.group) return hint.group;

  // Infer from top-level key
  const topKey = String(path[0]);

  // Known top-level groups
  const topLevelGroups: Record<string, string> = {
    gateway: "gateway",
    agents: "agents",
    channels: "channels",
    tools: "tools",
    models: "models",
    auth: "auth",
    commands: "commands",
    session: "session",
    cron: "cron",
    hooks: "hooks",
    ui: "ui",
    browser: "browser",
    talk: "talk",
    skills: "skills",
    plugins: "plugins",
    discovery: "discovery",
    presence: "presence",
    voicewake: "voicewake",
    logging: "logging",
    update: "update",
    diagnostics: "diagnostics",
    nodeHost: "nodeHost",
    meta: "meta",
    wizard: "wizard",
  };

  return topLevelGroups[topKey] ?? "other";
}

/** Group fields into sections */
export function groupFieldsIntoSections(
  fields: ConfigFieldInfo[],
  groups: typeof CONFIG_GROUPS,
): ConfigSection[] {
  const sectionMap = new Map<string, ConfigFieldInfo[]>();

  for (const field of fields) {
    const group = resolveGroup(field.path, field.hint);
    if (!sectionMap.has(group)) {
      sectionMap.set(group, []);
    }
    sectionMap.get(group)!.push(field);
  }

  const sections: ConfigSection[] = [];

  for (const [id, sectionFields] of sectionMap) {
    const groupInfo = groups[id] ?? { label: humanize(id), order: 500 };

    // Sort fields within section by order hint, then alphabetically
    sectionFields.sort((a, b) => {
      const orderA = a.hint.order ?? 100;
      const orderB = b.hint.order ?? 100;
      if (orderA !== orderB) return orderA - orderB;
      return a.key.localeCompare(b.key);
    });

    sections.push({
      id,
      label: groupInfo.label,
      order: groupInfo.order,
      fields: sectionFields,
    });
  }

  // Sort sections by order
  sections.sort((a, b) => a.order - b.order);

  return sections;
}

// ============================================
// Schema Traversal
// ============================================

/** Extract all fields from a schema */
export function extractFields(
  schema: JsonSchema,
  config: Record<string, unknown>,
  hints: ConfigUiHints,
  parentPath: (string | number)[] = [],
): ConfigFieldInfo[] {
  const fields: ConfigFieldInfo[] = [];

  if (!schema.properties) return fields;

  const required = new Set(schema.required ?? []);

  for (const [key, propSchema] of Object.entries(schema.properties)) {
    const path = [...parentPath, key];
    const pathKey = pathToKey(path);
    const hint = hintForPath(path, hints) ?? {};
    const value = getValueAtPath(config, path);
    const fieldType = resolveFieldType(propSchema, hint);

    // For objects with properties, we might want to flatten or keep nested
    // For now, keep top-level fields and nested objects as their own field type
    fields.push({
      path,
      key: pathKey,
      schema: propSchema,
      hint,
      fieldType,
      value,
      defaultValue: schemaDefault(propSchema),
      required: required.has(key),
    });
  }

  return fields;
}

// ============================================
// Validation
// ============================================

/** Basic validation of a value against schema */
export function validateValue(value: unknown, schema: JsonSchema): string | null {
  const type = schemaType(schema);

  // Required check (null/undefined)
  if (value === undefined || value === null) {
    // Check if nullable
    if (schema.nullable) return null;
    if (Array.isArray(schema.type) && schema.type.includes("null")) return null;
    // If there's a default, that's ok
    if (schema.default !== undefined) return null;
    return null; // Don't require by default at field level
  }

  // Type check
  switch (type) {
    case "string":
      if (typeof value !== "string") return "Must be a string";
      if (schema.minLength && value.length < schema.minLength) {
        return `Must be at least ${schema.minLength} characters`;
      }
      if (schema.maxLength && value.length > schema.maxLength) {
        return `Must be at most ${schema.maxLength} characters`;
      }
      if (schema.pattern) {
        const regex = new RegExp(schema.pattern);
        if (!regex.test(value)) return "Invalid format";
      }
      break;

    case "number":
    case "integer":
      if (typeof value !== "number") return "Must be a number";
      if (schema.minimum !== undefined && value < schema.minimum) {
        return `Must be at least ${schema.minimum}`;
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        return `Must be at most ${schema.maximum}`;
      }
      if (type === "integer" && !Number.isInteger(value)) {
        return "Must be an integer";
      }
      break;

    case "boolean":
      if (typeof value !== "boolean") return "Must be true or false";
      break;

    case "array":
      if (!Array.isArray(value)) return "Must be an array";
      if (schema.minItems && value.length < schema.minItems) {
        return `Must have at least ${schema.minItems} items`;
      }
      if (schema.maxItems && value.length > schema.maxItems) {
        return `Must have at most ${schema.maxItems} items`;
      }
      break;

    case "object":
      if (typeof value !== "object" || Array.isArray(value)) return "Must be an object";
      break;
  }

  // Enum check
  if (schema.enum && !schema.enum.includes(value)) {
    return "Invalid option";
  }

  return null;
}
