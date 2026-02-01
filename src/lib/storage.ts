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
import type { Theme } from "@/types/theme";

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

export interface StoredAuth {
  url: string;
  authMode: "token" | "password";
  credential?: string;
  rememberMe: boolean;
}

export function getAuth(): StoredAuth | null {
  return getRaw<StoredAuth>("auth");
}

export function saveAuth(auth: StoredAuth): void {
  setRaw("auth", auth);
}

export function clearAuth(): void {
  remove("auth");
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

export function setThemeCache(id: string, css: string): void {
  setRaw("theme-cache", { id, css });
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
