/**
 * Navigation Configuration
 *
 * Single source of truth for all app pages/views.
 * Add new pages here and they'll appear in sidebar + router automatically.
 */

import type { ComponentChildren } from "preact";

// ============================================
// Types
// ============================================

export interface NavItem {
  /** Unique view identifier (used in routing) */
  id: string;
  /** Display label (i18n key) */
  labelKey: string;
  /** Icon component */
  icon: () => ComponentChildren;
  /** External URL (opens in new tab instead of routing) */
  external?: string;
  /** Requires gateway connection to show */
  requiresConnection?: boolean;
}

export interface NavSection {
  /** Section title (i18n key) */
  titleKey: string;
  /** Items in this section */
  items: NavItem[];
}

// ============================================
// Icons
// ============================================

const ChatIcon = () => (
  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
    />
  </svg>
);

const OverviewIcon = () => (
  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
    />
  </svg>
);

const ChannelsIcon = () => (
  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
    />
  </svg>
);

const InstancesIcon = () => (
  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
    />
  </svg>
);

const SessionsIcon = () => (
  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
    />
  </svg>
);

const CronIcon = () => (
  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const SkillsIcon = () => (
  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M13 10V3L4 14h7v7l9-11h-7z"
    />
  </svg>
);

const NodesIcon = () => (
  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
    />
  </svg>
);

const ConfigIcon = () => (
  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

const DebugIcon = () => (
  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
    />
  </svg>
);

const LogsIcon = () => (
  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
);

const DocsIcon = () => (
  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
    />
  </svg>
);

// ============================================
// Navigation Configuration
// ============================================

export const navigation: NavSection[] = [
  {
    titleKey: "nav.sections.chat",
    items: [
      {
        id: "chat",
        labelKey: "nav.chat",
        icon: ChatIcon,
      },
    ],
  },
  {
    titleKey: "nav.sections.control",
    items: [
      {
        id: "overview",
        labelKey: "nav.overview",
        icon: OverviewIcon,
        requiresConnection: true,
      },
      {
        id: "channels",
        labelKey: "nav.channels",
        icon: ChannelsIcon,
        requiresConnection: true,
      },
      {
        id: "instances",
        labelKey: "nav.instances",
        icon: InstancesIcon,
        requiresConnection: true,
      },
      {
        id: "sessions",
        labelKey: "nav.sessions",
        icon: SessionsIcon,
        requiresConnection: true,
      },
      {
        id: "cron",
        labelKey: "nav.cron",
        icon: CronIcon,
        requiresConnection: true,
      },
    ],
  },
  {
    titleKey: "nav.sections.agent",
    items: [
      {
        id: "skills",
        labelKey: "nav.skills",
        icon: SkillsIcon,
        requiresConnection: true,
      },
      {
        id: "nodes",
        labelKey: "nav.nodes",
        icon: NodesIcon,
        requiresConnection: true,
      },
    ],
  },
  {
    titleKey: "nav.sections.settings",
    items: [
      {
        id: "config",
        labelKey: "nav.config",
        icon: ConfigIcon,
        requiresConnection: true,
      },
      {
        id: "debug",
        labelKey: "nav.debug",
        icon: DebugIcon,
        requiresConnection: true,
      },
      {
        id: "logs",
        labelKey: "nav.logs",
        icon: LogsIcon,
        requiresConnection: true,
      },
    ],
  },
  {
    titleKey: "nav.sections.resources",
    items: [
      {
        id: "docs",
        labelKey: "nav.docs",
        icon: DocsIcon,
        external: "https://docs.openclaw.ai",
      },
    ],
  },
];

// ============================================
// Derived Types & Helpers
// ============================================

/** All valid view IDs (derived from config) */
export type ViewId = (typeof navigation)[number]["items"][number]["id"];

/** Get all internal (non-external) view IDs */
export const internalViewIds = navigation
  .flatMap((section) => section.items)
  .filter((item) => !item.external)
  .map((item) => item.id);

/** Get a flat list of all nav items */
export const allNavItems = navigation.flatMap((section) => section.items);

/** Find a nav item by ID */
export function getNavItem(id: string): NavItem | undefined {
  return allNavItems.find((item) => item.id === id);
}

/** Check if a view ID is valid */
export function isValidView(id: string): id is ViewId {
  return allNavItems.some((item) => item.id === id && !item.external);
}
