/**
 * CompactionBanner
 *
 * Shows when the conversation is being compacted.
 */

import { Loader2 } from "lucide-preact";
import { isCompacting } from "@/signals/chat";

export function CompactionBanner() {
  if (!isCompacting.value) {
    return null;
  }

  return (
    <div
      class="px-4 py-2 text-sm flex items-center justify-center gap-2 bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
      role="status"
    >
      <Loader2 class="w-4 h-4 animate-spin" aria-hidden="true" />
      <span>Compacting conversation...</span>
    </div>
  );
}
