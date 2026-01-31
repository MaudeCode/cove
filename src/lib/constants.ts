/**
 * Chat System Constants
 *
 * Centralized configuration values for the chat system.
 */

/** Time window (ms) for considering consecutive messages as same turn */
export const SAME_TURN_THRESHOLD_MS = 60_000;

/** Default history message limit */
export const DEFAULT_HISTORY_LIMIT = 200;

/** Cleanup delay after run completes (ms) */
export const RUN_CLEANUP_DELAY_MS = 100;

/** Cleanup delay after run errors (ms) */
export const RUN_ERROR_CLEANUP_DELAY_MS = 5_000;

/** Cleanup delay after run aborts (ms) */
export const RUN_ABORT_CLEANUP_DELAY_MS = 1_000;

/** Separator for appended text blocks */
export const TEXT_BLOCK_SEPARATOR = "\n\n";

/** Animation duration for session deletion (ms) */
export const SESSION_DELETE_ANIMATION_MS = 300;
