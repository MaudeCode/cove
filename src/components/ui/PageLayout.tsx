/**
 * PageLayout
 *
 * Standard page container with error boundary, scrolling, and max-width.
 * Use this to wrap all view content for consistent layout.
 */

import type { ComponentChildren } from "preact";
import { ViewErrorBoundary } from "./ViewErrorBoundary";

interface PageLayoutProps {
  /** View name for error boundary */
  viewName: string;
  /** Page content */
  children: ComponentChildren;
  /** Optional max-width override (default: max-w-5xl) */
  maxWidth?: "4xl" | "5xl" | "6xl" | "7xl" | "full";
}

const maxWidthClasses = {
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
  full: "max-w-full",
};

export function PageLayout({ viewName, children, maxWidth = "5xl" }: PageLayoutProps) {
  return (
    <ViewErrorBoundary viewName={viewName}>
      <div class="flex-1 overflow-y-auto p-4 sm:p-6">
        <div class={`${maxWidthClasses[maxWidth]} mx-auto space-y-4 sm:space-y-6`}>{children}</div>
      </div>
    </ViewErrorBoundary>
  );
}
