/**
 * ViewErrorBoundary
 *
 * A specialized error boundary for view/page components.
 * Provides a more contextual error message and consistent styling.
 */

import { Component, type ComponentChildren } from "preact";
import { t } from "@/lib/i18n";
import { log } from "@/lib/logger";
import { Button } from "./Button";
import { AlertTriangle, RefreshCw } from "lucide-preact";

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
}

export class ViewErrorBoundary extends Component<ViewErrorBoundaryProps, ViewErrorBoundaryState> {
  constructor(props: ViewErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
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
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      const { viewName } = this.props;
      const { error } = this.state;

      return (
        <div class="flex-1 flex flex-col items-center justify-center p-8" role="alert">
          <div class="max-w-md w-full text-center space-y-4">
            <AlertTriangle
              class="w-12 h-12 mx-auto text-[var(--color-warning)]"
              aria-hidden="true"
            />

            <h2 class="text-lg font-semibold text-[var(--color-text-primary)]">
              {viewName ? t("errors.viewFailed", { view: viewName }) : t("errors.generic")}
            </h2>

            <p class="text-sm text-[var(--color-text-muted)]">
              {error?.message || t("errors.unknown")}
            </p>

            <Button
              onClick={this.handleRetry}
              variant="secondary"
              class="inline-flex items-center gap-2"
            >
              <RefreshCw class="w-4 h-4" aria-hidden="true" />
              {t("actions.retry")}
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
