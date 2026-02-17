/**
 * Command Palette Commands
 *
 * All available commands for the command palette.
 * Commands are context-aware and check availability dynamically.
 */

import { route } from "preact-router";
import { t } from "@/lib/i18n";
import { send, isConnected } from "@/lib/gateway";
import { abortChat } from "@/lib/chat/send";
import { clearMessages, isSearchOpen, searchQuery, messages } from "@/signals/chat";
import {
  sessions,
  activeSessionKey,
  setActiveSession,
  effectiveSessionKey,
} from "@/signals/sessions";
import { models } from "@/signals/models";
import { isSingleChatMode } from "@/signals/settings";
import { themePreference, setTheme, getAllThemes } from "@/lib/theme";
import type { Command, SubMenuItem } from "./types";
import type { Session } from "@/types/sessions";

// ============================================
// Shared Helpers
// ============================================

interface CronJob {
  id: string;
  name?: string;
  enabled: boolean;
}

/** Fetch cron jobs list with error handling */
async function fetchCronJobs(): Promise<CronJob[]> {
  try {
    const result = await send<{ jobs: CronJob[] }>("cron.list", {});
    return result.jobs || [];
  } catch {
    return [];
  }
}

// ============================================
// Chat Commands
// ============================================

const chatCommands: Command[] = [
  {
    id: "chat.abort",
    label: t("commandPalette.commands.chat.abort"),
    category: "chat",
    icon: "⏹",
    shortcut: "⌘.",
    action: () => {
      const sessionKey = effectiveSessionKey.value;
      if (sessionKey) {
        abortChat(sessionKey);
      }
    },
    keywords: ["stop", "cancel", "halt"],
  },
  {
    id: "chat.clear",
    label: t("commandPalette.commands.chat.clear"),
    category: "chat",
    icon: "🗑",
    action: () => {
      clearMessages();
    },
    keywords: ["delete", "reset", "empty"],
  },
  {
    id: "chat.search",
    label: t("commandPalette.commands.chat.search"),
    category: "chat",
    icon: "🔍",
    shortcut: "⌘F",
    action: () => {
      isSearchOpen.value = true;
      searchQuery.value = "";
    },
    keywords: ["find", "filter"],
  },
  {
    id: "chat.export",
    label: t("commandPalette.commands.chat.export"),
    category: "chat",
    icon: "📄",
    action: () => {
      const msgs = messages.value;
      if (msgs.length === 0) return;

      // Format as markdown
      const lines: string[] = [
        "# Chat Export",
        "",
        `Exported: ${new Date().toLocaleString()}`,
        "",
        "---",
        "",
      ];

      for (const msg of msgs) {
        const role = msg.role === "user" ? "**You**" : "**Assistant**";
        lines.push(role);
        lines.push("");
        lines.push(msg.content || "");
        lines.push("");
        lines.push("---");
        lines.push("");
      }

      const markdown = lines.join("\n");
      const blob = new Blob([markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chat-${new Date().toISOString().slice(0, 10)}.md`;
      a.click();
      URL.revokeObjectURL(url);
    },
    keywords: ["download", "save", "markdown"],
  },
  {
    id: "chat.copy-last",
    label: t("commandPalette.commands.chat.copyLast"),
    category: "chat",
    icon: "📋",
    action: async () => {
      const msgs = messages.value;
      const lastAssistant = [...msgs].reverse().find((m) => m.role === "assistant");
      if (lastAssistant?.content) {
        await navigator.clipboard.writeText(lastAssistant.content);
      }
    },
    keywords: ["clipboard"],
  },
];

// ============================================
// Session Commands
// ============================================

const sessionCommands: Command[] = [
  {
    id: "session.switch",
    label: t("commandPalette.commands.session.switch"),
    category: "session",
    icon: "🔄",
    hasSubmenu: true,
    getSubmenuItems: (): SubMenuItem[] => {
      const currentKey = activeSessionKey.value;
      return sessions.value.map((session: Session) => ({
        id: session.key,
        label: session.label || session.key,
        isActive: session.key === currentKey,
        description: session.model,
        action: () => {
          setActiveSession(session.key);
          route(`/chat/${encodeURIComponent(session.key)}`);
        },
      }));
    },
    isAvailable: () => !isSingleChatMode.value && sessions.value.length > 1,
    keywords: ["change", "select"],
  },
  {
    id: "session.delete",
    label: t("commandPalette.commands.session.delete"),
    category: "session",
    icon: "🗑",
    action: async () => {
      const sessionKey = effectiveSessionKey.value;
      if (sessionKey && confirm(t("common.deleteThisSession"))) {
        try {
          await send("sessions.delete", { key: sessionKey });
        } catch {
          // Session may already be deleted
        }
      }
    },
    isAvailable: () => !isSingleChatMode.value,
    keywords: ["remove"],
  },
  {
    id: "session.copy-key",
    label: t("commandPalette.commands.session.copyKey"),
    category: "session",
    icon: "🔑",
    action: async () => {
      const sessionKey = effectiveSessionKey.value;
      if (sessionKey) {
        await navigator.clipboard.writeText(sessionKey);
      }
    },
    keywords: ["clipboard"],
  },
];

// ============================================
// Model Commands
// ============================================

const modelCommands: Command[] = [
  {
    id: "model.change",
    label: t("commandPalette.commands.model.change"),
    category: "model",
    icon: "🤖",
    hasSubmenu: true,
    getSubmenuItems: (): SubMenuItem[] => {
      return models.value.map((model) => ({
        id: model.id,
        label: model.name || model.id,
        description: model.provider,
        action: async () => {
          const sessionKey = effectiveSessionKey.value;
          if (sessionKey) {
            try {
              await send("sessions.patch", { key: sessionKey, model: model.id });
            } catch {
              // Failed to update model
            }
          }
        },
      }));
    },
    keywords: ["switch", "select", "ai"],
  },
];

// ============================================
// Cron Commands
// ============================================

const cronCommands: Command[] = [
  {
    id: "cron.run",
    label: t("commandPalette.commands.cron.run"),
    category: "cron",
    icon: "▶️",
    hasSubmenu: true,
    getSubmenuItems: async (): Promise<SubMenuItem[]> => {
      const jobs = await fetchCronJobs();
      if (jobs.length === 0) {
        return [{ id: "none", label: t("common.noItems"), action: () => {} }];
      }
      return jobs.map((job) => ({
        id: job.id,
        label: job.name || job.id,
        description: job.enabled ? t("common.enabled") : t("common.disabled"),
        action: async () => {
          try {
            await send("cron.run", { jobId: job.id });
          } catch {
            // Failed to run job
          }
        },
      }));
    },
    isAvailable: () => isConnected.value,
    keywords: ["trigger", "execute", "schedule"],
  },
  {
    id: "cron.toggle",
    label: t("commandPalette.commands.cron.toggle"),
    category: "cron",
    icon: "⏯",
    hasSubmenu: true,
    getSubmenuItems: async (): Promise<SubMenuItem[]> => {
      const jobs = await fetchCronJobs();
      if (jobs.length === 0) {
        return [{ id: "none", label: t("common.noItems"), action: () => {} }];
      }
      return jobs.map((job) => ({
        id: job.id,
        label: `${job.name || job.id}: ${job.enabled ? "ON" : "OFF"}`,
        isActive: job.enabled,
        action: async () => {
          try {
            await send("cron.update", { jobId: job.id, patch: { enabled: !job.enabled } });
          } catch {
            // Failed to toggle job
          }
        },
      }));
    },
    isAvailable: () => isConnected.value,
    keywords: ["enable", "disable", "schedule"],
  },
];

// ============================================
// Gateway Commands
// ============================================

const gatewayCommands: Command[] = [
  {
    id: "gateway.restart",
    label: t("commandPalette.commands.gateway.restart"),
    category: "gateway",
    icon: "🔄",
    action: async () => {
      if (confirm(t("commandPalette.confirm.restartGateway"))) {
        try {
          await send("gateway.restart", {});
        } catch {
          // Connection will drop, that's expected
        }
      }
    },
    isAvailable: () => isConnected.value,
    keywords: ["reboot", "reload", "refresh"],
  },
];

// ============================================
// Settings Commands
// ============================================

const settingsCommands: Command[] = [
  {
    id: "settings.theme",
    label: t("commandPalette.commands.settings.theme"),
    category: "settings",
    icon: "🎨",
    hasSubmenu: true,
    getValue: () => {
      const pref = themePreference.value;
      if (pref.selected === "system") return t("commandPalette.commands.settings.systemTheme");
      const themes = getAllThemes();
      const theme = themes.find((t) => t.id === pref.selected);
      return theme?.name || pref.selected;
    },
    getSubmenuItems: (): SubMenuItem[] => {
      const current = themePreference.value.selected;
      const themes = getAllThemes();

      // System option first
      const items: SubMenuItem[] = [
        {
          id: "system",
          label: t("commandPalette.commands.settings.systemTheme"),
          isActive: current === "system",
          action: () => setTheme("system"),
        },
      ];

      // Then all themes
      for (const theme of themes) {
        items.push({
          id: theme.id,
          label: theme.name,
          description: theme.appearance === "dark" ? t("common.dark") : t("common.light"),
          isActive: current === theme.id,
          action: () => setTheme(theme.id),
        });
      }

      return items;
    },
    keywords: [
      "dark",
      "light",
      "appearance",
      "color",
      "dracula",
      "monokai",
      "nord",
      "catppuccin",
      "gruvbox",
      "solarized",
    ],
  },
];

// ============================================
// Export All Commands
// ============================================

export const allCommands: Command[] = [
  ...chatCommands,
  ...sessionCommands,
  ...modelCommands,
  ...cronCommands,
  ...gatewayCommands,
  ...settingsCommands,
];

/**
 * Get available commands based on current context
 */
export function getAvailableCommands(): Command[] {
  return allCommands.filter((cmd) => {
    if (cmd.isAvailable) {
      return cmd.isAvailable();
    }
    return true;
  });
}
