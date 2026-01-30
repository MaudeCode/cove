/**
 * AppShell
 *
 * Main layout container with sidebar and content area.
 * Handles responsive behavior (desktop/tablet/mobile).
 */

import type { ComponentChildren } from "preact";
import { sidebarOpen } from "@/signals/ui";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";

interface AppShellProps {
  children: ComponentChildren;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div class="h-screen p-2 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      {/* Skip to content link for accessibility */}
      <a
        href="#main-content"
        class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-[var(--color-accent)] focus:text-white focus:rounded-xl"
      >
        Skip to content
      </a>

      {/* Main container with rounded corners */}
      <div class="h-full flex flex-col rounded-2xl overflow-hidden border border-[var(--color-border)] shadow-soft-lg bg-[var(--color-bg-surface)]">
        <TopBar />

        <div class="flex-1 flex overflow-hidden">
          {/* Sidebar - hidden on mobile when closed */}
          <aside
            class={`
              flex-shrink-0 w-64 border-r border-[var(--color-border)]
              bg-[var(--color-bg-secondary)] overflow-hidden
              transition-all duration-200 ease-out
              ${sidebarOpen.value ? "translate-x-0" : "-translate-x-full w-0 border-r-0"}
              lg:translate-x-0 lg:w-64 lg:border-r
            `}
          >
            <Sidebar />
          </aside>

          {/* Mobile overlay when sidebar is open */}
          {sidebarOpen.value && (
            <div
              class="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => (sidebarOpen.value = false)}
              aria-hidden="true"
            />
          )}

          {/* Main content area */}
          <main
            id="main-content"
            class="flex-1 flex flex-col overflow-hidden bg-[var(--color-bg-primary)]"
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
