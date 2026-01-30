/**
 * Sidebar
 *
 * Sessions list and navigation sections.
 */

import { t } from "@/lib/i18n";
import { isConnected } from "@/lib/gateway";
import { activeView, type View } from "@/signals/ui";
import { activeSessionKey, setActiveSession, sessionsByRecent } from "@/signals/sessions";

export function Sidebar() {
  return (
    <div class="h-full flex flex-col">
      {/* New Chat button */}
      <div class="p-3">
        <button
          type="button"
          disabled={!isConnected.value}
          onClick={() => {
            setActiveSession("main");
            activeView.value = "chat";
          }}
          class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
            bg-[var(--color-accent)] text-white font-medium
            hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed
            transition-opacity"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
          {t("actions.newChat")}
        </button>
      </div>

      {/* Sessions section */}
      <nav class="flex-1 overflow-y-auto px-3 pb-3">
        <SidebarSection title={t("nav.sessions")} defaultOpen>
          {sessionsByRecent.value.length === 0 ? (
            <p class="text-sm text-[var(--color-text-muted)] px-2 py-4">
              {t("sessions.noSessions")}
            </p>
          ) : (
            <ul class="space-y-1">
              {sessionsByRecent.value.map((session) => (
                <li key={session.key}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSession(session.key);
                      activeView.value = "chat";
                    }}
                    class={`
                      w-full text-left px-3 py-2 rounded-lg text-sm
                      flex items-center gap-2 transition-colors
                      ${
                        activeSessionKey.value === session.key
                          ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                          : "hover:bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
                      }
                    `}
                  >
                    <span
                      class={`w-2 h-2 rounded-full flex-shrink-0 ${
                        activeSessionKey.value === session.key
                          ? "bg-[var(--color-accent)]"
                          : "bg-[var(--color-text-muted)]"
                      }`}
                      aria-hidden="true"
                    />
                    <span class="truncate">{session.label || session.key}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SidebarSection>
      </nav>

      {/* Bottom navigation sections */}
      <div class="border-t border-[var(--color-border)] px-3 py-2">
        <NavItem
          icon={<ClockIcon />}
          label={t("nav.cron")}
          view="cron"
          active={activeView.value === "cron"}
        />
        <NavItem
          icon={<CogIcon />}
          label={t("nav.config")}
          view="config"
          active={activeView.value === "config"}
        />
        <NavItem
          icon={<ChartIcon />}
          label={t("nav.status")}
          view="status"
          active={activeView.value === "status"}
        />
      </div>
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

interface SidebarSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: preact.ComponentChildren;
}

function SidebarSection({
  title,
  defaultOpen: _defaultOpen = true,
  children,
}: SidebarSectionProps) {
  // For now, always open. Could add collapsible behavior later.
  return (
    <div class="mb-4">
      <h3 class="px-2 py-1 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
        {title}
      </h3>
      {children}
    </div>
  );
}

interface NavItemProps {
  icon: preact.ComponentChildren;
  label: string;
  view: View;
  active: boolean;
}

function NavItem({ icon, label, view, active }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={() => (activeView.value = view)}
      class={`
        w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm
        transition-colors
        ${
          active
            ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
            : "hover:bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)]"
        }
      `}
    >
      <span class="w-5 h-5" aria-hidden="true">
        {icon}
      </span>
      {label}
    </button>
  );
}

// ============================================
// Icons (inline SVGs for now, could use lucide-preact later)
// ============================================

function ClockIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function CogIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  );
}
