/**
 * HeartbeatIndicator
 *
 * Shows heartbeat count with dropdown to view recent heartbeats.
 * Heartbeats are filtered out of the main chat - this is where they live.
 */

import { useState, useRef, useCallback } from "preact/hooks";
import { Heart } from "lucide-preact";
import { IconButton } from "@/components/ui/IconButton";
import { Badge } from "@/components/ui/Badge";
import { heartbeatMessages, heartbeatCount } from "@/signals/chat";
import { t, formatTimestamp } from "@/lib/i18n";
import { isHeartbeatResponse } from "@/lib/message-detection";
import { useClickOutside } from "@/hooks/useClickOutside";

const SEEN_COUNT_KEY = "cove:heartbeat-seen-count";

function loadSeenCount(): number {
  try {
    const stored = localStorage.getItem(SEEN_COUNT_KEY);
    return stored ? parseInt(stored, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

function saveSeenCount(count: number): void {
  try {
    localStorage.setItem(SEEN_COUNT_KEY, String(count));
  } catch {
    // Ignore storage errors
  }
}

export function HeartbeatIndicator() {
  const count = heartbeatCount.value;
  const [isOpen, setIsOpen] = useState(false);
  const [seenCount, setSeenCount] = useState(loadSeenCount);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  // Number of new (unseen) heartbeats
  const exchangeCount = Math.floor(count / 2);
  const unseenCount = Math.max(0, exchangeCount - seenCount);

  // Mark as seen when dropdown closes
  const handleClose = useCallback(() => {
    setSeenCount(exchangeCount);
    saveSeenCount(exchangeCount);
    setIsOpen(false);
  }, [exchangeCount]);

  // Close dropdown when clicking outside
  useClickOutside([buttonRef, dropdownRef], handleClose, isOpen);

  // Get heartbeat exchanges (pair prompt + response)
  const heartbeats = heartbeatMessages.value;
  // Group into exchanges - each response represents one heartbeat check
  const exchanges = heartbeats.filter(isHeartbeatResponse).slice(-10).reverse();

  return (
    <div class="relative inline-block" ref={buttonRef}>
      <IconButton
        icon={<Heart class="w-4 h-4" />}
        label={t("chat.heartbeats", { count })}
        onClick={() => (isOpen ? handleClose() : setIsOpen(true))}
        variant="ghost"
        size="sm"
        class="border border-[var(--color-border)] bg-[var(--color-bg-surface)]"
      />
      {unseenCount > 0 && (
        <Badge
          variant="default"
          class="absolute -top-1.5 -right-1.5 min-w-[1.25rem] h-5 text-xs px-1 pointer-events-none"
        >
          {unseenCount}
        </Badge>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          class="absolute top-full left-0 mt-1 z-50 min-w-[240px] max-h-[300px] overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] shadow-lg"
        >
          <div class="px-3 py-2 border-b border-[var(--color-border)]">
            <span class="text-sm font-medium text-[var(--color-text-primary)]">
              {t("chat.heartbeatsTitle")}
            </span>
          </div>
          <div class="py-1">
            {exchanges.length === 0 ? (
              <div class="px-3 py-4 text-sm text-[var(--color-text-muted)] text-center">
                {t("chat.noHeartbeats")}
              </div>
            ) : (
              exchanges.map((hb) => (
                <div
                  key={hb.id}
                  class="px-3 py-2 flex items-center gap-2 text-sm hover:bg-[var(--color-bg-hover)]"
                >
                  <span class="text-[var(--color-success)]">✓</span>
                  <span class="text-[var(--color-text-muted)]">
                    {formatTimestamp(hb.timestamp)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
