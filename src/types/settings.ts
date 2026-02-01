/**
 * Settings Types
 *
 * Type definitions for user settings and auth state stored in localStorage.
 * These are the source of truth — storage.ts imports from here.
 */

import type { TimeFormat, FontSize } from "@/signals/settings";

/**
 * User settings stored in localStorage
 */
export interface StoredSettings {
  /** Selected theme ID */
  theme: string;

  /** Locale for i18n */
  locale: string;

  /** Time display format */
  timeFormat: TimeFormat;

  /** Font size */
  fontSize: FontSize;
}

/**
 * Auth credentials stored in localStorage
 */
export interface StoredAuth {
  /** Gateway URL */
  url: string;

  /** Auth mode */
  authMode: "token" | "password";

  /** Stored credential (token or password if remember me) */
  credential?: string;

  /** Whether to persist credentials */
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
  hasCompletedOnboarding: boolean;
  pendingTour: boolean;
}
