/**
 * Typed localStorage Wrapper
 *
 * Central storage layer for all persisted state.
 * All localStorage access should go through this module.
 *
 * Benefits:
 * - Consistent key prefixing
 * - Type safety
 * - Central migration path
 * - Error handling
 */

import type { Message } from "@/types/messages";
import type { Session } from "@/types/sessions";
import type { UsageSummary } from "@/types/usage";
import type { SessionsUsageResult } from "@/types/server-stats";
import type { Theme, ThemeAppearance, ThemeColors } from "@/types/theme";

// ============================================
// Configuration
// ============================================

const PREFIX = "cove:";
const SCHEMA_VERSION = 1;

// ============================================
// Core Functions
// ============================================

/**
 * Get a raw value from storage (handles prefix and JSON parsing)
 */
function getRaw<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Set a raw value in storage (handles prefix and JSON serialization)
 */
function setRaw<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Quota exceeded or other error - silently fail
  }
}

/**
 * Remove a value from storage
 */
function remove(key: string): void {
  localStorage.removeItem(PREFIX + key);
}

// ============================================
// Auth
// ============================================

/**
 * Stored auth preferences (URL and mode only)
 */
export interface StoredAuth {
  url: string;
  authMode: "token" | "password";
  rememberMe: boolean;
}

/**
 * Parameters for saveAuth - includes optional credential
 */
export interface SaveAuthParams extends StoredAuth {
  credential?: string;
}

/**
 * Session-only auth (includes credential for current session)
 * Cleared when browser tab/window closes
 */
interface SessionAuth {
  credential: string;
}

const SESSION_AUTH_KEY = "cove:session-auth";

export function getAuth(): StoredAuth | null {
  // Read with legacy type that may include credential (for migration)
  const stored = getRaw<StoredAuth & { credential?: string }>("auth");
  if (!stored) return null;

  // Migrate: if old stored auth has credential, clear it
  if (stored.credential) {
    saveAuth({ ...stored, credential: undefined });
    // Move credential to session storage for this session only
    setSessionCredential(stored.credential);
  }

  return stored;
}

export function saveAuth(auth: SaveAuthParams): void {
  const safeAuth: StoredAuth = {
    url: auth.url,
    authMode: auth.authMode,
    rememberMe: auth.rememberMe,
  };
  setRaw("auth", safeAuth);

  // Store credential based on rememberMe preference
  if (auth.credential) {
    if (auth.rememberMe) {
      // rememberMe: persist in localStorage (survives PWA restart)
      setRaw("credential", auth.credential);
      clearSessionCredential();
    } else {
      // No rememberMe: session only (cleared when PWA closes)
      setSessionCredential(auth.credential);
      remove("credential");
    }
  }
}

export function clearAuth(): void {
  remove("auth");
  remove("credential");
  clearSessionCredential();
}

/**
 * Store credential in sessionStorage (current session only)
 * Automatically cleared when tab/window closes
 */
export function setSessionCredential(credential: string): void {
  try {
    sessionStorage.setItem(SESSION_AUTH_KEY, JSON.stringify({ credential }));
  } catch {
    // Quota exceeded or other error
  }
}

/**
 * Get credential - checks localStorage first (rememberMe), then sessionStorage
 */
export function getSessionCredential(): string | null {
  try {
    // Check localStorage first (rememberMe enabled)
    const remembered = getRaw<string>("credential");
    if (remembered) return remembered;

    // Fall back to sessionStorage
    const raw = sessionStorage.getItem(SESSION_AUTH_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SessionAuth;
    return data.credential || null;
  } catch {
    return null;
  }
}

/**
 * Clear credential from sessionStorage
 */
export function clearSessionCredential(): void {
  try {
    sessionStorage.removeItem(SESSION_AUTH_KEY);
  } catch {
    // Ignore errors
  }
}

// ============================================
// Onboarding
// ============================================

export function hasCompletedOnboarding(): boolean {
  return getRaw<boolean>("hasCompletedOnboarding") ?? false;
}

export function completeOnboarding(): void {
  setRaw("hasCompletedOnboarding", true);
}

export function setPendingTour(show: boolean): void {
  setRaw("pendingTour", show);
}

export function consumePendingTour(): boolean {
  const pending = getRaw<boolean>("pendingTour") ?? false;
  if (pending) {
    remove("pendingTour");
  }
  return pending;
}

// ============================================
// User Preferences
// ============================================

export type TimeFormat = "relative" | "local";
export type FontSize = "sm" | "md" | "lg";
export type FontFamily = "geist" | "inter" | "system" | "dyslexic" | "mono";

const PREFERENCE_DEFAULTS = {
  timeFormat: "relative" as TimeFormat,
  fontSize: "md" as FontSize,
  fontFamily: "geist" as FontFamily,
  locale: "en",
  theme: "system",
  sidebarWidth: 280,
};

export function getTimeFormat(): TimeFormat {
  return getRaw<TimeFormat>("time-format") ?? PREFERENCE_DEFAULTS.timeFormat;
}

export function setTimeFormat(value: TimeFormat): void {
  setRaw("time-format", value);
}

export function getFontSize(): FontSize {
  return getRaw<FontSize>("font-size") ?? PREFERENCE_DEFAULTS.fontSize;
}

export function setFontSize(value: FontSize): void {
  setRaw("font-size", value);
}

export function getFontFamily(): FontFamily {
  return getRaw<FontFamily>("font-family") ?? PREFERENCE_DEFAULTS.fontFamily;
}

export function setFontFamily(value: FontFamily): void {
  setRaw("font-family", value);
}

export function getLocale(): string {
  const stored = getRaw<string>("locale");
  if (stored) return stored;

  // Detect from browser
  const browserLocale = navigator.language || "en";
  return browserLocale.startsWith("en") ? "en" : "en";
}

export function getThemePreference<T>(): T | null {
  return getRaw<T>("theme-preference");
}

export function setThemePreference<T>(pref: T): void {
  setRaw("theme-preference", pref);
}

export function getSidebarWidth(): number {
  return getRaw<number>("sidebarWidth") ?? PREFERENCE_DEFAULTS.sidebarWidth;
}

export function setSidebarWidth(width: number): void {
  setRaw("sidebarWidth", width);
}

// ============================================
// Caches
// ============================================

interface MessagesCache {
  sessionKey: string;
  messages: Message[];
}

export function getMessagesCache(): MessagesCache | null {
  const sessionKey = getRaw<string>("messages-session");
  const messages = getRaw<Message[]>("messages-cache");
  if (sessionKey && messages) {
    return { sessionKey, messages };
  }
  return null;
}

export function setMessagesCache(sessionKey: string, messages: Message[]): void {
  setRaw("messages-session", sessionKey);
  setRaw("messages-cache", messages);
}

export function getSessionsCache(): Session[] | null {
  return getRaw<Session[]>("sessions-cache");
}

export function setSessionsCache(sessions: Session[]): void {
  setRaw("sessions-cache", sessions);
}

export function getUsageCache(): UsageSummary | null {
  return getRaw<UsageSummary>("usage-cache");
}

export function setUsageCache(usage: UsageSummary): void {
  setRaw("usage-cache", usage);
}

export function getSessionsUsageCache(): SessionsUsageResult | null {
  return getRaw<SessionsUsageResult>("sessions-usage-cache");
}

export function setSessionsUsageCache(data: SessionsUsageResult): void {
  setRaw("sessions-usage-cache", data);
}

export function getModelFavorites(): Set<string> {
  const stored = getRaw<string[]>("model-favorites");
  return new Set(stored ?? []);
}

export function setModelFavorites(favorites: Set<string>): void {
  setRaw("model-favorites", [...favorites]);
}

// ============================================
// Custom Themes
// ============================================

export function getCustomThemes(): Theme[] {
  return getRaw<Theme[]>("custom-themes") ?? [];
}

export interface ThemeCache {
  id: string;
  appearance: ThemeAppearance;
  colors: ThemeColors;
}

export function setThemeCache(cache: ThemeCache): void {
  setRaw("theme-cache", cache);
}

// ============================================
// New Chat Settings
// ============================================

export interface NewChatSettings {
  /** Skip agent picker, use defaults immediately */
  useDefaults: boolean;
  /** Default agent ID for new chats */
  defaultAgentId: string;
}

const DEFAULT_NEW_CHAT_SETTINGS: NewChatSettings = {
  useDefaults: true,
  defaultAgentId: "main",
};

export function getNewChatSettings(): NewChatSettings {
  return getRaw<NewChatSettings>("new-chat-settings") ?? DEFAULT_NEW_CHAT_SETTINGS;
}

export function setNewChatSettings(settings: NewChatSettings): void {
  setRaw("new-chat-settings", settings);
}

// ============================================
// App Mode
// ============================================

/** App interface mode */
export type AppMode = "single" | "multi";

export function getAppMode(): AppMode {
  return getRaw<AppMode>("app-mode") ?? "single";
}

export function setAppMode(mode: AppMode): void {
  setRaw("app-mode", mode);
}

// ============================================
// Canvas Node
// ============================================

export function getCanvasNodeEnabled(): boolean {
  return getRaw<boolean>("canvas-node-enabled") ?? false;
}

export function setCanvasNodeEnabled(enabled: boolean): void {
  setRaw("canvas-node-enabled", enabled);
}

// ============================================
// Heartbeat
// ============================================

export function getHeartbeatSeenCount(): number {
  return getRaw<number>("heartbeat-seen-count") ?? 0;
}

export function setHeartbeatSeenCount(count: number): void {
  setRaw("heartbeat-seen-count", count);
}

// ============================================
// Migration
// ============================================

/**
 * Run migrations if needed.
 * Called once on app init.
 */
export function initStorage(): void {
  const version = getRaw<number>("schemaVersion") ?? 0;

  if (version < SCHEMA_VERSION) {
    // Run migrations here when needed
    // Example:
    // if (version < 2) { migrateV1toV2(); }

    setRaw("schemaVersion", SCHEMA_VERSION);
  }
}
