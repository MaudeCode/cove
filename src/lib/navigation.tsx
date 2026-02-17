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
  BarChart3,
  Bot,
} from "lucide-preact";
import { siDiscord } from "simple-icons";
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
const UsageIcon = () => <BarChart3 class={iconClass} aria-hidden="true" />;
const ChannelsIcon = () => <Link class={iconClass} aria-hidden="true" />;
const InstancesIcon = () => <Wifi class={iconClass} aria-hidden="true" />;
const SessionsIcon = () => <Layers class={iconClass} aria-hidden="true" />;
const CronIcon = () => <Clock class={iconClass} aria-hidden="true" />;
const SkillsIcon = () => <Zap class={iconClass} aria-hidden="true" />;
const AgentsIcon = () => <Bot class={iconClass} aria-hidden="true" />;
const DevicesIcon = () => <Smartphone class={iconClass} aria-hidden="true" />;
const ConfigIcon = () => <Settings class={iconClass} aria-hidden="true" />;
const DebugIcon = () => <SlidersHorizontal class={iconClass} aria-hidden="true" />;
const LogsIcon = () => <FileText class={iconClass} aria-hidden="true" />;
const DocsIcon = () => <BookOpen class={iconClass} aria-hidden="true" />;
const GitHubIcon = () => <Github class={iconClass} aria-hidden="true" />;
const DiscordIcon = () => (
  <svg
    role="img"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    class={iconClass}
    aria-hidden="true"
  >
    <path fill="currentColor" d={siDiscord.path} />
  </svg>
);
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
        labelKey: "common.overview",
        icon: OverviewIcon,
        requiresConnection: true,
      },
      {
        id: "usage",
        labelKey: "common.usage",
        icon: UsageIcon,
        requiresConnection: true,
      },
      {
        id: "channels",
        labelKey: "common.channels",
        icon: ChannelsIcon,
        requiresConnection: true,
      },
      {
        id: "instances",
        labelKey: "common.instances",
        icon: InstancesIcon,
        requiresConnection: true,
      },
      {
        id: "sessions",
        labelKey: "common.sessions",
        icon: SessionsIcon,
        requiresConnection: true,
      },
      {
        id: "cron",
        labelKey: "common.cronJobs",
        icon: CronIcon,
        requiresConnection: true,
      },
    ],
  },
  {
    titleKey: "common.agent",
    items: [
      {
        id: "skills",
        labelKey: "common.skills",
        icon: SkillsIcon,
        requiresConnection: true,
      },
      {
        id: "agents",
        labelKey: "common.agents",
        icon: AgentsIcon,
        requiresConnection: true,
      },
      {
        id: "devices",
        labelKey: "common.devices",
        icon: DevicesIcon,
        requiresConnection: true,
      },
    ],
  },
  {
    titleKey: "common.settings",
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
        labelKey: "common.debug",
        icon: DebugIcon,
        requiresConnection: true,
      },
      {
        id: "logs",
        labelKey: "common.logs",
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
        labelKey: "common.docs",
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
        id: "github-openclaw",
        labelKey: "nav.githubOpenClaw",
        icon: GitHubIcon,
        external: EXTERNAL_URLS.githubOpenClaw,
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
