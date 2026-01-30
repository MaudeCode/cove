/**
 * AppShell
 *
 * Main layout container with sidebar and content area.
 * Handles responsive behavior (desktop/tablet/mobile).
 */

import type { ComponentChildren } from "preact";
import {
  sidebarOpen,
  sidebarWidth,
  sidebarResizing,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_MAX_WIDTH,
} from "@/signals/ui";
import { ResizeHandle } from "@/components/ui";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";

interface AppShellProps {
  children: ComponentChildren;
}

export function AppShell({ children }: AppShellProps) {
  const handleResize = (delta: number) => {
    const newWidth = Math.max(
      SIDEBAR_MIN_WIDTH,
      Math.min(SIDEBAR_MAX_WIDTH, sidebarWidth.value + delta),
    );
    sidebarWidth.value = newWidth;
  };

  return (
    <div class="h-screen flex flex-col bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]">
      {/* Skip to content link for accessibility */}
      <a
        href="#main-content"
        class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-[var(--color-accent)] focus:text-white focus:rounded-xl"
      >
        Skip to content
      </a>

      <TopBar />

      <div class="flex-1 flex overflow-hidden">
        {/* Sidebar - hidden on mobile when closed */}
        <aside
          style={{ width: sidebarOpen.value ? `${sidebarWidth.value}px` : "0" }}
          class={`
            flex-shrink-0 p-2 pr-0
            bg-[var(--color-bg-secondary)] overflow-hidden
            ${sidebarResizing.value ? "" : "transition-all duration-200 ease-out"}
            ${sidebarOpen.value ? "translate-x-0" : "-translate-x-full p-0"}
            lg:translate-x-0 lg:p-2 lg:pr-0
          `}
        >
          <div class="h-full rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] shadow-soft-sm overflow-hidden">
            <Sidebar />
          </div>
        </aside>

        {/* Resize handle - only visible on desktop when sidebar is open */}
        {sidebarOpen.value && (
          <div class="hidden lg:flex items-center py-2">
            <ResizeHandle
              direction="horizontal"
              onResizeStart={() => (sidebarResizing.value = true)}
              onResize={handleResize}
              onResizeEnd={() => (sidebarResizing.value = false)}
              class="h-[calc(100%-4rem)] rounded-full"
            />
          </div>
        )}

        {/* Mobile overlay when sidebar is open */}
        {sidebarOpen.value && (
          <div
            class="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => (sidebarOpen.value = false)}
            aria-hidden="true"
          />
        )}

        {/* Main content area - rounded panel */}
        <main id="main-content" class="flex-1 flex flex-col overflow-hidden p-2 pl-0 lg:pl-0">
          <div class="h-full rounded-2xl bg-[var(--color-bg-primary)] border border-[var(--color-border)] shadow-soft overflow-hidden flex flex-col">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
