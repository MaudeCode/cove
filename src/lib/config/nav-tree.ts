/**
 * Nav Tree Utilities
 *
 * Functions for building the config navigation tree from schema.
 */

import type { JsonSchema, ConfigUiHints } from "@/types/config";
import { humanize } from "./schema-utils";

// ============================================
// Types
// ============================================

export interface NavItem {
  key: string;
  label: string;
  path: (string | number)[];
  children?: NavItem[];
  schema?: JsonSchema;
}

// ============================================
// Utilities
// ============================================

/**
 * Checks if a schema has any inline fields (non-nav-worthy properties).
 * Used to determine if "General" section should be shown.
 */
export function hasInlineFields(schema: JsonSchema): boolean {
  if (!schema.properties) return false;

  return Object.values(schema.properties).some((propSchema) => !isNavWorthy(propSchema));
}

/**
 * Checks if a schema property is "navigation-worthy" (should appear in sidebar).
 * Only objects with 2+ properties or arrays of objects qualify.
 * Single-field objects and primitives should just be rendered inline.
 */
export function isNavWorthy(propSchema: JsonSchema): boolean {
  // Arrays of objects are nav-worthy (expandable list)
  if (propSchema.type === "array" && propSchema.items?.properties) {
    return true;
  }

  // Objects must have 2+ properties to be worth navigating to
  if (propSchema.type === "object" && propSchema.properties) {
    const propCount = Object.keys(propSchema.properties).length;
    return propCount >= 2;
  }

  return false;
}

/**
 * Build navigation tree from schema and config values.
 */
export function buildNavTree(
  schemaObj: JsonSchema,
  config: Record<string, unknown>,
  hints: ConfigUiHints,
  parentPath: string[] = [],
  depth: number = 0,
): NavItem[] {
  if (!schemaObj.properties) return [];

  const items: NavItem[] = [];

  for (const [key, propSchema] of Object.entries(schemaObj.properties)) {
    const path = [...parentPath, key];
    const hint = hints[key] ?? hints[path.join(".")] ?? {};
    const label = hint.label ?? propSchema.title ?? humanize(key);

    // At depth 0 (top-level), include everything as nav items
    // At deeper levels, only include nav-worthy items
    if (depth > 0 && !isNavWorthy(propSchema)) {
      continue;
    }

    const item: NavItem = {
      key,
      label,
      path,
      schema: propSchema,
    };

    // If it's an object with properties, add children
    if (propSchema.type === "object" && propSchema.properties) {
      const configValue = (config[key] as Record<string, unknown>) ?? {};
      item.children = buildNavTree(propSchema, configValue, hints, path, depth + 1);
      // Remove empty children array
      if (item.children.length === 0) {
        delete item.children;
      }
    }

    // If it's an array of objects, add each item as a child
    if (propSchema.type === "array" && propSchema.items?.properties) {
      const arrayValue = (config[key] as unknown[]) ?? [];
      item.children = arrayValue.map((itemValue, index) => {
        const obj = itemValue as Record<string, unknown>;
        const identity = obj.identity as Record<string, unknown> | undefined;
        const displayName = obj.id ?? obj.name ?? obj.label ?? `#${index + 1}`;
        const emoji = identity?.emoji ?? "";

        return {
          key: String(index),
          label: emoji ? `${emoji} ${displayName}` : String(displayName),
          path: [...path, index],
          schema: propSchema.items,
        };
      });
    }

    items.push(item);
  }

  // Sort by hint order
  items.sort((a, b) => {
    const orderA = hints[a.key]?.order ?? 100;
    const orderB = hints[b.key]?.order ?? 100;
    return orderA - orderB;
  });

  return items;
}
