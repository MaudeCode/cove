/**
 * Config Schema Utilities
 *
 * Helpers for working with JSON Schema and UI hints.
 */

import type { JsonSchema, ConfigUiHint, ConfigUiHints } from "@/types/config";

// ============================================
// Path Utilities
// ============================================

/** Convert path array to dot-separated string */
export function pathToKey(path: (string | number)[]): string {
  return path.join(".");
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
