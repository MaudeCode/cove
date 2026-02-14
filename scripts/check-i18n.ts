#!/usr/bin/env bun
/**
 * i18n Key Checker (v2 - simple grep approach)
 *
 * For each key in en.json, checks if it appears as a literal string in the codebase.
 * Much simpler and more accurate than pattern-based extraction.
 *
 * Usage:
 *   bun scripts/check-i18n.ts          # Check and report
 *   bun scripts/check-i18n.ts --fix    # Remove unused keys
 *   bun scripts/check-i18n.ts -v       # Verbose output
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

const LOCALE_FILE = "src/locales/en.json";
const SRC_DIR = "src";

// Keys that are generated dynamically via template literals
// e.g., t(`commandPalette.categories.${category}`)
const DYNAMIC_KEY_PREFIXES = ["commandPalette.categories."];

// ============================================
// Helpers
// ============================================

function getAllKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      keys.push(...getAllKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function getAllFiles(dir: string, extensions: string[]): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...getAllFiles(fullPath, extensions));
    } else if (extensions.includes(extname(entry))) {
      files.push(fullPath);
    }
  }

  return files;
}

function removeKey(obj: Record<string, unknown>, keyPath: string): boolean {
  const parts = keyPath.split(".");
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (typeof current[part] !== "object" || current[part] === null) {
      return false;
    }
    current = current[part] as Record<string, unknown>;
  }

  const lastPart = parts[parts.length - 1];
  if (lastPart in current) {
    delete current[lastPart];
    return true;
  }
  return false;
}

function cleanEmptyObjects(obj: Record<string, unknown>): void {
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      cleanEmptyObjects(value as Record<string, unknown>);
      if (Object.keys(value as Record<string, unknown>).length === 0) {
        delete obj[key];
      }
    }
  }
}

// ============================================
// Main
// ============================================

function main() {
  const args = process.argv.slice(2);
  const shouldFix = args.includes("--fix");
  const verbose = args.includes("--verbose") || args.includes("-v");

  console.log("🌐 Checking i18n keys...\n");

  // Load locale file
  const localeContent = readFileSync(LOCALE_FILE, "utf-8");
  const locale = JSON.parse(localeContent) as Record<string, unknown>;
  const definedKeys = getAllKeys(locale);

  // Load all source files into memory (excluding locale file itself)
  const sourceFiles = getAllFiles(SRC_DIR, [".ts", ".tsx"]).filter(
    (f) => !f.includes("locales/")
  );

  const allSourceContent = sourceFiles
    .map((f) => readFileSync(f, "utf-8"))
    .join("\n");

  // Simple check: does the key string appear anywhere in the source?
  const unusedKeys: string[] = [];
  const usedKeys: string[] = [];
  const definedKeySet = new Set(definedKeys);

  for (const key of definedKeys) {
    // Check for the key as a quoted string (most common)
    // This catches: t("key"), "key" in objects, `key` in templates, etc.
    if (
      allSourceContent.includes(`"${key}"`) ||
      allSourceContent.includes(`'${key}'`) ||
      allSourceContent.includes(`\`${key}\``)
    ) {
      usedKeys.push(key);
    } else if (DYNAMIC_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      // Key is used dynamically via template literal
      usedKeys.push(key);
    } else {
      unusedKeys.push(key);
    }
  }

  // Find missing keys: t() calls referencing keys that don't exist
  // Process line by line to skip comments
  const missingKeys: string[] = [];
  const tCallPattern = /t\(["'`]([a-zA-Z][a-zA-Z0-9]*\.[a-zA-Z0-9_.]+)["'`]/g;
  
  for (const line of allSourceContent.split("\n")) {
    // Skip comment lines
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
      continue;
    }
    
    let match;
    while ((match = tCallPattern.exec(line)) !== null) {
      const key = match[1];
      if (!definedKeySet.has(key) && !missingKeys.includes(key)) {
        missingKeys.push(key);
      }
    }
    tCallPattern.lastIndex = 0;
  }
  missingKeys.sort();

  // Sort for consistent output
  unusedKeys.sort();

  // Report
  let hasErrors = false;

  // Missing keys are errors (will cause runtime failures)
  if (missingKeys.length > 0) {
    hasErrors = true;
    console.log(`❌ Missing keys (used in code but not in en.json): ${missingKeys.length}`);
    console.log("   These will cause runtime errors!\n");
    for (const key of missingKeys) {
      console.log(`   - ${key}`);
    }
    console.log();
  }

  // Unused keys are warnings
  if (unusedKeys.length > 0) {
    console.log(`⚠️  Unused keys (not found in source): ${unusedKeys.length}`);
    if (verbose) {
      console.log();
      for (const key of unusedKeys) {
        console.log(`   - ${key}`);
      }
    } else {
      // Group by top-level section
      const sections = new Map<string, number>();
      for (const key of unusedKeys) {
        const section = key.split(".")[0];
        sections.set(section, (sections.get(section) || 0) + 1);
      }
      console.log();
      for (const [section, count] of [...sections.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`   ${section}: ${count} keys`);
      }
      console.log("\n   Run with -v to see all keys");
    }
    console.log();

    if (shouldFix) {
      console.log("🔧 Removing unused keys...\n");
      for (const key of unusedKeys) {
        removeKey(locale, key);
      }
      cleanEmptyObjects(locale);

      const newContent = JSON.stringify(locale, null, 2) + "\n";
      writeFileSync(LOCALE_FILE, newContent);
      console.log(`✅ Removed ${unusedKeys.length} unused keys from ${LOCALE_FILE}`);
    }
  }

  if (missingKeys.length === 0 && unusedKeys.length === 0) {
    console.log("✅ All i18n keys are valid!");
  }

  // Summary
  console.log(
    `\n📊 Summary: ${definedKeys.length} defined, ${usedKeys.length} used, ${unusedKeys.length} unused, ${missingKeys.length} missing`
  );

  // Exit with error if missing keys (these cause runtime failures)
  if (hasErrors) {
    process.exit(1);
  }
}

main();
