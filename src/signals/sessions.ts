/**
 * Sessions Signals
 *
 * Chat session state.
 *
 * @see Phase 0.9 in ROADMAP.md for full spec
 */

import { signal, computed } from "@preact/signals";
import type { Session } from "@/types/sessions";

/** All known sessions */
export const sessions = signal<Session[]>([]);

/** Currently active session key */
export const activeSessionKey = signal<string | null>(null);

/** The currently active session (derived) */
export const activeSession = computed(
  () => sessions.value.find((s) => s.key === activeSessionKey.value) ?? null,
);
