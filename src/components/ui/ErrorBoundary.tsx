/**
 * ErrorBoundary Component
 *
 * Catches JavaScript errors in child components and displays fallback UI.
 * Uses class component because error boundaries require lifecycle methods.
 */

import { Component, type ComponentChildren } from "preact";
import { t } from "@/lib/i18n";
import { Button } from "./Button";

export interface ErrorBoundaryProps {
  /** Child components to render */
  children: ComponentChildren;
  /** Custom fallback UI (optional) */
  fallback?: ComponentChildren;
  /** Called when error is caught */
  onError?: (error: Error, errorInfo: { componentStack: string }) => void;
  /** Called when retry is clicked */
  onRetry?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: { componentStack: string } | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }): void {
    this.setState({ errorInfo });

    // Call error handler if provided
    this.props.onError?.(error, errorInfo);

    // Log to console for debugging
    console.error("[ErrorBoundary] Caught error:", error);
    console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Default error fallback UI
 */
interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: { componentStack: string } | null;
  onRetry: () => void;
}

function ErrorFallback({ error, errorInfo, onRetry }: ErrorFallbackProps) {
  const isDev = import.meta.env.DEV;

  return (
    <div class="flex-1 flex items-center justify-center p-8" role="alert" aria-live="assertive">
      <div class="max-w-md w-full text-center">
        {/* Icon */}
        <div class="text-5xl mb-4">⚠️</div>

        {/* Title */}
        <h2 class="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
          {t("errors.generic")}
        </h2>

        {/* Message */}
        <p class="text-[var(--color-text-muted)] mb-6">{error?.message || t("errors.unknown")}</p>

        {/* Retry button */}
        <Button onClick={onRetry} variant="primary">
          {t("actions.retry")}
        </Button>

        {/* Developer details (dev mode only) */}
        {isDev && errorInfo && (
          <details class="mt-6 text-left">
            <summary class="text-xs text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-text-secondary)]">
              Developer details
            </summary>
            <pre class="mt-2 p-3 text-xs bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg overflow-x-auto whitespace-pre-wrap">
              <strong>Error:</strong> {error?.toString()}
              {"\n\n"}
              <strong>Component Stack:</strong>
              {errorInfo.componentStack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

/**
 * Inline error component for use within views
 */
export interface InlineErrorProps {
  /** Error message */
  message: string;
  /** Called when retry is clicked */
  onRetry?: () => void;
  /** Additional class names */
  class?: string;
}

export function InlineError({ message, onRetry, class: className }: InlineErrorProps) {
  return (
    <div
      class={`
        flex flex-col items-center justify-center gap-3 p-6
        bg-[var(--color-error)]/5 border border-[var(--color-error)]/20
        rounded-lg text-center
        ${className || ""}
      `}
      role="alert"
    >
      <span class="text-2xl">❌</span>
      <p class="text-sm text-[var(--color-error)]">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="secondary" size="sm">
          {t("actions.retry")}
        </Button>
      )}
    </div>
  );
}
