/**
 * Settings Types
 */

import type { Theme, TimeFormat, FontSize } from "@/signals/settings";

/** User settings stored in localStorage */
export interface UserSettings {
  /** Color theme */
  theme: Theme;

  /** Locale for i18n */
  locale: string;

  /** Time display format */
  timeFormat: TimeFormat;

  /** Font size */
  fontSize: FontSize;

  /** Font family */
  fontFamily: string;
}

/** Auth state stored in localStorage */
export interface AuthState {
  /** Gateway URL */
  gatewayUrl: string;

  /** Auth mode */
  authMode: "password" | "token";

  /** Stored token (if remember me) */
  token?: string;

  /** Recent session keys */
  recentSessions: string[];
}
