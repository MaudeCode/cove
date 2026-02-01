/**
 * Navigation Configuration
 *
 * Single source of truth for all app pages/views.
 * Add new pages here and they'll appear in sidebar + router automatically.
 */

import type { ComponentChildren } from "preact";
import {
  LayoutDashboard,
  Link,
  Wifi,
  Layers,
  Clock,
  Zap,
  Smartphone,
  Settings,
  SlidersHorizontal,
  FileText,
  BookOpen,
  Palette,
  Github,
  MessageCircle,
} from "lucide-preact";
import { EXTERNAL_URLS } from "@/lib/constants";

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
// Icons (using lucide-preact)
// ============================================

const iconClass = "w-5 h-5";

const OverviewIcon = () => <LayoutDashboard class={iconClass} aria-hidden="true" />;
const ChannelsIcon = () => <Link class={iconClass} aria-hidden="true" />;
const InstancesIcon = () => <Wifi class={iconClass} aria-hidden="true" />;
const SessionsIcon = () => <Layers class={iconClass} aria-hidden="true" />;
const CronIcon = () => <Clock class={iconClass} aria-hidden="true" />;
const SkillsIcon = () => <Zap class={iconClass} aria-hidden="true" />;
const NodesIcon = () => <Smartphone class={iconClass} aria-hidden="true" />;
const ConfigIcon = () => <Settings class={iconClass} aria-hidden="true" />;
const DebugIcon = () => <SlidersHorizontal class={iconClass} aria-hidden="true" />;
const LogsIcon = () => <FileText class={iconClass} aria-hidden="true" />;
const DocsIcon = () => <BookOpen class={iconClass} aria-hidden="true" />;
const GitHubIcon = () => <Github class={iconClass} aria-hidden="true" />;
const DiscordIcon = () => <MessageCircle class={iconClass} aria-hidden="true" />;
const SettingsIcon = () => <Palette class={iconClass} aria-hidden="true" />;

// ============================================
// Navigation Configuration
// ============================================

export const navigation: NavSection[] = [
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
        id: "settings",
        labelKey: "nav.settings",
        icon: SettingsIcon,
      },
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
        external: EXTERNAL_URLS.docs,
      },
      {
        id: "github",
        labelKey: "nav.github",
        icon: GitHubIcon,
        external: EXTERNAL_URLS.github,
      },
      {
        id: "discord",
        labelKey: "nav.discord",
        icon: DiscordIcon,
        external: EXTERNAL_URLS.discord,
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
