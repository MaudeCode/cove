/**
 * StateRenderer
 *
 * Handles common view states: loading, empty, error.
 * Renders the appropriate UI based on the current state.
 */

import type { ComponentChildren } from "preact";
import { t } from "@/lib/i18n";
import { Spinner } from "./Spinner";
import { Button } from "./Button";
import { AlertTriangle, Inbox } from "lucide-preact";

export interface StateRendererProps {
  /** Whether data is loading */
  isLoading?: boolean;
  /** Error message (if any) */
  error?: string | null;
  /** Whether the data is empty */
  isEmpty?: boolean;
  /** Custom loading message */
  loadingMessage?: string;
  /** Custom empty state title */
  emptyTitle?: string;
  /** Custom empty state description */
  emptyDescription?: string;
  /** Custom empty state icon */
  emptyIcon?: ComponentChildren;
  /** Called when retry is clicked (for error state) */
  onRetry?: () => void;
  /** The content to render when not in loading/error/empty state */
  children: ComponentChildren;
}

/**
 * Renders loading, error, or empty states with consistent styling.
 * Shows children when data is ready.
 */
export function StateRenderer({
  isLoading = false,
  error = null,
  isEmpty = false,
  loadingMessage,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  onRetry,
  children,
}: StateRendererProps) {
  // Loading state
  if (isLoading) {
    return (
      <div class="flex flex-col items-center justify-center py-12 text-center">
        <Spinner size="lg" />
        {loadingMessage && (
          <p class="mt-4 text-sm text-[var(--color-text-muted)]">{loadingMessage}</p>
        )}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div class="flex flex-col items-center justify-center py-12 text-center">
        <div class="p-3 rounded-full bg-[var(--color-error)]/10 mb-4">
          <AlertTriangle class="w-8 h-8 text-[var(--color-error)]" />
        </div>
        <h3 class="text-lg font-medium text-[var(--color-text-primary)] mb-2">
          {t("errors.generic")}
        </h3>
        <p class="text-sm text-[var(--color-text-muted)] max-w-md mb-4">{error}</p>
        {onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            {t("common.tryAgain")}
          </Button>
        )}
      </div>
    );
  }

  // Empty state
  if (isEmpty) {
    return (
      <div class="flex flex-col items-center justify-center py-12 text-center">
        <div class="p-3 rounded-full bg-[var(--color-bg-tertiary)] mb-4">
          {emptyIcon ?? <Inbox class="w-8 h-8 text-[var(--color-text-muted)]" />}
        </div>
        <h3 class="text-lg font-medium text-[var(--color-text-primary)] mb-2">
          {emptyTitle ?? t("common.noData")}
        </h3>
        {emptyDescription && (
          <p class="text-sm text-[var(--color-text-muted)] max-w-md">{emptyDescription}</p>
        )}
      </div>
    );
  }

  // Data ready - render children
  return <>{children}</>;
}
