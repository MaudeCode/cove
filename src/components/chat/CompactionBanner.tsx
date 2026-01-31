/**
 * CompactionBanner
 *
 * Shows when the conversation is being compacted.
 * Positioned as a floating pill overlay so it doesn't shift layout.
 */

import { Loader2 } from "lucide-preact";
import { isCompacting } from "@/signals/chat";

export function CompactionBanner() {
  if (!isCompacting.value) {
    return null;
  }

  return (
    <div
      class="absolute top-2 left-1/2 -translate-x-1/2 z-20 px-4 py-2 text-sm flex items-center gap-2 bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] rounded-full shadow-lg border border-[var(--color-border)]"
      role="status"
    >
      <Loader2 class="w-4 h-4 animate-spin" aria-hidden="true" />
      <span>Compacting conversation...</span>
    </div>
  );
}
