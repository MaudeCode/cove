/**
 * Shared constants for log components
 */

import { Info, AlertTriangle, AlertCircle, Bug } from "lucide-preact";
import type { LogLevel } from "./log-parser";

/** Level → icon mapping */
export const levelIcons: Record<LogLevel, typeof Info> = {
  debug: Bug,
  info: Info,
  warn: AlertTriangle,
  error: AlertCircle,
};

/** Level → text color class mapping */
export const levelColors: Record<LogLevel, string> = {
  debug: "text-[var(--color-text-muted)]",
  info: "text-[var(--color-info)]",
  warn: "text-[var(--color-warning)]",
  error: "text-[var(--color-error)]",
};

/** Format log timestamp for display (show time portion only) */
export function formatLogTimestamp(timestamp: string | null | undefined): string | null {
  if (!timestamp) return null;
  return timestamp.split("T")[1]?.slice(0, 12) || timestamp.slice(0, 12);
}
