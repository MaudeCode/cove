/**
 * Typed localStorage Wrapper
 *
 * Provides type-safe access to localStorage with:
 * - Schema validation
 * - JSON serialization
 * - Migration support
 * - Quota error handling
 */

// ============================================
// Schema Definition
// ============================================

/**
 * User settings stored in localStorage
 */
export interface StoredSettings {
  theme: string;
  locale: string;
  timeFormat: "relative" | "local";
  fontSize: "sm" | "md" | "lg";
}

/**
 * Auth credentials stored in localStorage
 */
export interface StoredAuth {
  url: string;
  authMode: "token" | "password";
  credential?: string;
  rememberMe: boolean;
}

/**
 * Complete storage schema
 */
export interface StorageSchema {
  settings: StoredSettings;
  auth: StoredAuth;
  recentSessions: string[];
  schemaVersion: number;
}

/**
 * Current schema version - increment when schema changes
 */
const CURRENT_SCHEMA_VERSION = 1;

/**
 * Storage key prefix to avoid collisions
 */
const PREFIX = "cove:";

// ============================================
// Default Values
// ============================================

const defaults: StorageSchema = {
  settings: {
    theme: "system",
    locale: "en",
    timeFormat: "relative",
    fontSize: "md",
  },
  auth: {
    url: "",
    authMode: "token",
    rememberMe: true,
  },
  recentSessions: [],
  schemaVersion: CURRENT_SCHEMA_VERSION,
};

// ============================================
// Core Functions
// ============================================

/**
 * Get a value from storage
 */
export function get<K extends keyof StorageSchema>(key: K): StorageSchema[K] | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return null;

    const parsed = JSON.parse(raw) as StorageSchema[K];
    return parsed;
  } catch {
    // Invalid JSON or other error
    return null;
  }
}

/**
 * Get a value from storage with a default fallback
 */
export function getWithDefault<K extends keyof StorageSchema>(
  key: K,
  defaultValue: StorageSchema[K],
): StorageSchema[K] {
  const value = get(key);
  return value ?? defaultValue;
}

/**
 * Set a value in storage
 *
 * @throws StorageQuotaError if quota is exceeded
 */
export function set<K extends keyof StorageSchema>(key: K, value: StorageSchema[K]): void {
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(PREFIX + key, serialized);
  } catch (err) {
    if (isQuotaError(err)) {
      throw new StorageQuotaError(`Storage quota exceeded when saving ${key}`);
    }
    throw err;
  }
}

/**
 * Remove a value from storage
 */
export function remove(key: keyof StorageSchema): void {
  localStorage.removeItem(PREFIX + key);
}

/**
 * Clear all Cove storage
 */
export function clear(): void {
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX)) {
      keysToRemove.push(key);
    }
  }

  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
}

// ============================================
// Migration Support
// ============================================

type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/**
 * Migration functions keyed by target version
 */
const migrations: Record<number, Migration> = {
  // Example: Migration to version 2
  // 2: (data) => {
  //   // Transform data from v1 to v2
  //   return { ...data, newField: 'default' };
  // },
};

/**
 * Run migrations if needed
 */
export function runMigrations(): void {
  const storedVersion = get("schemaVersion") ?? 0;

  if (storedVersion >= CURRENT_SCHEMA_VERSION) {
    return; // Already up to date
  }

  // Run each migration in order
  for (let version = storedVersion + 1; version <= CURRENT_SCHEMA_VERSION; version++) {
    const migration = migrations[version];
    if (migration) {
      // Get all current data
      const allData: Record<string, unknown> = {};
      for (const key of Object.keys(defaults) as Array<keyof StorageSchema>) {
        allData[key] = get(key);
      }

      // Run migration
      const migratedData = migration(allData);

      // Save migrated data
      for (const [key, value] of Object.entries(migratedData)) {
        if (key in defaults) {
          set(key as keyof StorageSchema, value as StorageSchema[keyof StorageSchema]);
        }
      }
    }
  }

  // Update schema version
  set("schemaVersion", CURRENT_SCHEMA_VERSION);
}

// ============================================
// Convenience Functions
// ============================================

/**
 * Get settings with defaults
 */
export function getSettings(): StoredSettings {
  return getWithDefault("settings", defaults.settings);
}

/**
 * Update settings (partial update)
 */
export function updateSettings(updates: Partial<StoredSettings>): void {
  const current = getSettings();
  set("settings", { ...current, ...updates });
}

/**
 * Get auth credentials
 */
export function getAuth(): StoredAuth | null {
  return get("auth");
}

/**
 * Save auth credentials
 */
export function saveAuth(auth: StoredAuth): void {
  set("auth", auth);
}

/**
 * Clear auth credentials
 */
export function clearAuth(): void {
  remove("auth");
}

/**
 * Get recent sessions
 */
export function getRecentSessions(): string[] {
  return getWithDefault("recentSessions", []);
}

/**
 * Add a session to recent list (max 20, most recent first)
 */
export function addRecentSession(sessionKey: string): void {
  const recent = getRecentSessions();
  const filtered = recent.filter((key) => key !== sessionKey);
  const updated = [sessionKey, ...filtered].slice(0, 20);
  set("recentSessions", updated);
}

// ============================================
// Error Handling
// ============================================

/**
 * Custom error for quota exceeded
 */
export class StorageQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageQuotaError";
  }
}

/**
 * Check if an error is a quota exceeded error
 */
function isQuotaError(err: unknown): boolean {
  if (err instanceof DOMException) {
    // Different browsers use different error names/codes
    return (
      err.code === 22 || // Legacy
      err.code === 1014 || // Firefox
      err.name === "QuotaExceededError" ||
      err.name === "NS_ERROR_DOM_QUOTA_REACHED"
    );
  }
  return false;
}

/**
 * Check available storage space (approximate)
 */
export async function checkStorageQuota(): Promise<{ used: number; available: number } | null> {
  if ("storage" in navigator && "estimate" in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage ?? 0,
        available: estimate.quota ?? 0,
      };
    } catch {
      return null;
    }
  }
  return null;
}

// ============================================
// Initialization
// ============================================

/**
 * Initialize storage - run migrations and set defaults
 */
export function initStorage(): void {
  runMigrations();
}
