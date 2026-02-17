/**
 * ToolsTab
 *
 * Configure tool access for the agent.
 */

import { t } from "@/lib/i18n";
import { Card } from "@/components/ui/Card";
import { Dropdown } from "@/components/ui/Dropdown";
import { Toggle } from "@/components/ui/Toggle";
import { Spinner } from "@/components/ui/Spinner";
import { CheckCircle, XCircle } from "lucide-preact";
import { AgentTabSaveButton } from "./AgentTabSaveButton";
import {
  toolsLoading,
  toolsSaving,
  toolsDirty,
  localToolsConfig,
  isToolEnabled,
  updateToolProfile,
  toggleTool,
  saveToolsConfig,
} from "../agent-state";

// ============================================
// Constants
// ============================================

const TOOL_PROFILES = [
  { value: "full", labelKey: "agents.tools.profiles.full" },
  { value: "coding", labelKey: "agents.tools.profiles.coding" },
  { value: "messaging", labelKey: "agents.tools.profiles.messaging" },
  { value: "minimal", labelKey: "agents.tools.profiles.minimal" },
] as const;

interface ToolDef {
  id: string;
  label: string;
  descriptionKey: string;
}

interface ToolSection {
  id: string;
  labelKey: string;
  tools: ToolDef[];
}

const TOOL_SECTIONS: ToolSection[] = [
  {
    id: "fs",
    labelKey: "common.files",
    tools: [
      { id: "read", label: "read", descriptionKey: "agents.tools.toolDescriptions.read" },
      { id: "write", label: "write", descriptionKey: "agents.tools.toolDescriptions.write" },
      { id: "edit", label: "edit", descriptionKey: "agents.tools.toolDescriptions.edit" },
    ],
  },
  {
    id: "runtime",
    labelKey: "agents.tools.sections.runtime",
    tools: [
      { id: "exec", label: "exec", descriptionKey: "agents.tools.toolDescriptions.exec" },
      { id: "process", label: "process", descriptionKey: "agents.tools.toolDescriptions.process" },
    ],
  },
  {
    id: "web",
    labelKey: "agents.tools.sections.web",
    tools: [
      {
        id: "web_search",
        label: "web_search",
        descriptionKey: "agents.tools.toolDescriptions.webSearch",
      },
      {
        id: "web_fetch",
        label: "web_fetch",
        descriptionKey: "agents.tools.toolDescriptions.webFetch",
      },
      { id: "browser", label: "browser", descriptionKey: "agents.tools.toolDescriptions.browser" },
    ],
  },
  {
    id: "memory",
    labelKey: "agents.tools.sections.memory",
    tools: [
      {
        id: "memory_search",
        label: "memory_search",
        descriptionKey: "agents.tools.toolDescriptions.memorySearch",
      },
      {
        id: "memory_get",
        label: "memory_get",
        descriptionKey: "agents.tools.toolDescriptions.memoryGet",
      },
    ],
  },
  {
    id: "sessions",
    labelKey: "common.sessions",
    tools: [
      {
        id: "sessions_list",
        label: "sessions_list",
        descriptionKey: "agents.tools.toolDescriptions.sessionsList",
      },
      {
        id: "sessions_send",
        label: "sessions_send",
        descriptionKey: "agents.tools.toolDescriptions.sessionsSend",
      },
      {
        id: "sessions_spawn",
        label: "sessions_spawn",
        descriptionKey: "agents.tools.toolDescriptions.sessionsSpawn",
      },
    ],
  },
  {
    id: "automation",
    labelKey: "agents.tools.sections.automation",
    tools: [
      { id: "message", label: "message", descriptionKey: "agents.tools.toolDescriptions.message" },
      { id: "cron", label: "cron", descriptionKey: "agents.tools.toolDescriptions.cron" },
      { id: "gateway", label: "gateway", descriptionKey: "agents.tools.toolDescriptions.gateway" },
      { id: "nodes", label: "nodes", descriptionKey: "agents.tools.toolDescriptions.nodes" },
    ],
  },
];

// ============================================
// ToolsTab Component
// ============================================

export function ToolsTab() {
  if (toolsLoading.value) {
    return (
      <div class="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  const profile = localToolsConfig.value.profile ?? "full";
  const enabledCount = TOOL_SECTIONS.flatMap((s) => s.tools).filter((tool) =>
    isToolEnabled(tool.id),
  ).length;
  const totalCount = TOOL_SECTIONS.flatMap((s) => s.tools).length;

  return (
    <div class="space-y-4">
      <Card>
        <div class="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <div>
            <h3 class="text-base font-semibold">{t("common.tools")}</h3>
            <p class="text-sm text-[var(--color-text-muted)]">
              {t("agents.tools.enabled", { count: `${enabledCount}/${totalCount}` })}
            </p>
          </div>
          {toolsDirty.value && (
            <AgentTabSaveButton onClick={saveToolsConfig} saving={toolsSaving.value} />
          )}
        </div>
        <div class="p-4">
          <span class="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">
            {t("agents.tools.profile")}
          </span>
          <Dropdown
            value={profile}
            options={TOOL_PROFILES.map((p) => ({ value: p.value, label: t(p.labelKey) }))}
            onChange={updateToolProfile}
            class="mt-2 w-full"
            aria-label={t("agents.tools.profile")}
          />
        </div>
      </Card>

      {TOOL_SECTIONS.map((section) => (
        <Card key={section.id}>
          <div class="p-4 border-b border-[var(--color-border)]">
            <h4 class="text-sm font-semibold">{t(section.labelKey)}</h4>
          </div>
          <div class="divide-y divide-[var(--color-border)]">
            {section.tools.map((tool) => {
              const enabled = isToolEnabled(tool.id);
              return (
                <div
                  key={tool.id}
                  class="p-4 flex items-center justify-between gap-4 hover:bg-[var(--color-bg-hover)]"
                >
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <code class="text-sm font-medium">{tool.label}</code>
                      {enabled ? (
                        <CheckCircle class="w-4 h-4 text-[var(--color-success)]" />
                      ) : (
                        <XCircle class="w-4 h-4 text-[var(--color-text-muted)]" />
                      )}
                    </div>
                    <p class="text-xs text-[var(--color-text-muted)]">{t(tool.descriptionKey)}</p>
                  </div>
                  <Toggle checked={enabled} onChange={(v) => toggleTool(tool.id, v)} />
                </div>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}
