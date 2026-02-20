/**
 * UpdateBanner
 *
 * Floating banner that shows when a gateway update is available.
 * Swipe up to dismiss on mobile.
 */

import { useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { Download, ExternalLink, X } from "lucide-preact";
import { t } from "@/lib/i18n";
import { updateAvailable, isUpdateDismissed, dismissUpdate } from "@/signals/update";

function getReleaseUrl(version: string): string {
  const tag = version.startsWith("v") ? version : `v${version}`;
  return `https://github.com/openclaw/openclaw/releases/tag/${tag}`;
}

export function UpdateBanner() {
  const update = updateAvailable.value;
  const touchStartY = useRef(0);
  const isSwiping = useRef(false);
  const swipeOffset = useSignal(0);
  const isDismissing = useSignal(false);

  // Don't show if no update, dismissed, or animating out
  if (!update || isUpdateDismissed()) {
    return null;
  }

  const handleTouchStart = (e: TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    isSwiping.current = true;
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isSwiping.current) return;
    const deltaY = touchStartY.current - e.touches[0].clientY;
    // Only allow swiping up (positive delta)
    swipeOffset.value = Math.max(0, deltaY);
  };

  const handleTouchEnd = () => {
    isSwiping.current = false;
    // Dismiss if swiped up more than 50px
    if (swipeOffset.value > 50) {
      isDismissing.value = true;
      setTimeout(() => {
        dismissUpdate();
        isDismissing.value = false;
        swipeOffset.value = 0;
      }, 150);
    } else {
      swipeOffset.value = 0;
    }
  };

  const translateY = isDismissing.value ? -100 : -swipeOffset.value;

  return (
    <div
      class="fixed top-2 left-2 right-2 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto sm:w-auto z-50 pointer-events-none"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div
        class={`
          pointer-events-auto rounded-xl shadow-lg border border-[var(--color-border)]
          bg-[var(--color-bg-surface)] text-[var(--color-text-primary)]
          px-4 py-2.5 flex items-center justify-between gap-3
          ${isDismissing.value ? "transition-transform duration-150" : swipeOffset.value > 0 ? "" : "animate-slide-in-top"}
        `}
        style={{ transform: `translateY(${translateY}px)` }}
        role="alert"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Left: Icon + text */}
        <div class="flex items-center gap-3 min-w-0">
          <Download class="w-5 h-5 flex-shrink-0 text-[var(--color-accent)]" aria-hidden="true" />
          <div class="flex flex-col min-w-0">
            <span class="text-xs text-[var(--color-text-muted)]">{t("update.gatewayLabel")}</span>
            <span class="text-sm font-medium truncate">
              {update.currentVersion} → {update.latestVersion}
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div class="flex items-center flex-shrink-0">
          <a
            href={getReleaseUrl(update.latestVersion)}
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center justify-center gap-1 text-[var(--color-accent)] hover:underline whitespace-nowrap min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 sm:px-2 text-sm"
          >
            <span class="hidden sm:inline">{t("update.viewRelease")}</span>
            <ExternalLink class="w-4 h-4" aria-hidden="true" />
          </a>
          <button
            type="button"
            onClick={dismissUpdate}
            class="inline-flex items-center justify-center min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 sm:p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] rounded-lg"
            aria-label={t("actions.dismiss")}
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
