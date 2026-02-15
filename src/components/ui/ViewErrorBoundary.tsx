/**
 * ViewErrorBoundary
 *
 * A specialized error boundary for view/page components.
 * Shows a friendly error page with collapsible details.
 */

import { Component, type ComponentChildren } from "preact";
import { t } from "@/lib/i18n";
import { log } from "@/lib/logger";
import { toast } from "./Toast";
import { Button } from "./Button";
import { RefreshCw, ChevronDown, ChevronUp, Copy } from "lucide-preact";

export interface ViewErrorBoundaryProps {
  /** Child components to render */
  children: ComponentChildren;
  /** Name of the view for error context (e.g., "Settings", "Chat") */
  viewName?: string;
  /** Called when retry is clicked */
  onRetry?: () => void;
}

interface ViewErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  detailsOpen: boolean;
}

export class ViewErrorBoundary extends Component<ViewErrorBoundaryProps, ViewErrorBoundaryState> {
  constructor(props: ViewErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      detailsOpen: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ViewErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }): void {
    const { viewName } = this.props;
    log.ui.error(`ViewErrorBoundary caught error in ${viewName || "unknown view"}:`, error);
    log.ui.error("Component stack:", errorInfo.componentStack);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, detailsOpen: false });
    this.props.onRetry?.();
  };

  toggleDetails = (): void => {
    this.setState((prev) => ({ detailsOpen: !prev.detailsOpen }));
  };

  copyError = (): void => {
    const { error } = this.state;
    if (error) {
      const text = `${error.name}: ${error.message}\n\n${error.stack || ""}`;
      navigator.clipboard.writeText(text);
      toast.success(t("actions.copied"));
    }
  };

  render() {
    if (this.state.hasError) {
      const { error, detailsOpen } = this.state;

      return (
        <div
          class="flex-1 flex flex-col items-center justify-start p-8 pt-16 overflow-auto"
          role="alert"
        >
          <div class="max-w-lg w-full text-center space-y-6">
            {/* Lobster mascot */}
            <img
              src="/confused-lobster.png"
              alt=""
              class="w-80 h-auto mx-auto rounded-xl"
              aria-hidden="true"
            />

            {/* Friendly headline */}
            <div class="space-y-2">
              <h2 class="text-xl font-semibold text-[var(--color-text-primary)]">
                {t("errors.errorPage.title")}
              </h2>
              <p class="text-sm text-[var(--color-text-muted)]">{t("errors.errorPage.subtitle")}</p>
            </div>

            {/* Retry button */}
            <Button
              onClick={this.handleRetry}
              variant="secondary"
              icon={<RefreshCw class="w-4 h-4" />}
            >
              {t("actions.retry")}
            </Button>

            {/* Collapsible error details */}
            {error && (
              <div class="text-left">
                <button
                  type="button"
                  onClick={this.toggleDetails}
                  class="flex items-center gap-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                >
                  {detailsOpen ? <ChevronUp class="w-4 h-4" /> : <ChevronDown class="w-4 h-4" />}
                  {t("errors.errorPage.details")}
                </button>

                {detailsOpen && (
                  <div class="mt-2 relative">
                    <pre class="p-3 bg-[var(--color-bg-tertiary)] rounded-lg text-xs text-[var(--color-text-muted)] overflow-x-auto max-h-40 overflow-y-auto">
                      <code>
                        {error.name}: {error.message}
                        {error.stack && `\n\n${error.stack}`}
                      </code>
                    </pre>
                    <button
                      type="button"
                      onClick={this.copyError}
                      class="absolute top-2 right-2 p-1.5 rounded bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                      title={t("actions.copy")}
                    >
                      <Copy class="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
