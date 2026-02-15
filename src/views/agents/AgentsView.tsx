/**
 * AgentsView
 *
 * Manage agents: overview, workspace files, tools, and skills.
 */

import { useEffect } from "preact/hooks";
import { t } from "@/lib/i18n";
import { isConnected } from "@/lib/gateway";
import { useQueryParam, useInitFromParam, useSyncFilterToParam } from "@/hooks/useQueryParam";
import { Spinner } from "@/components/ui/Spinner";
import { IconButton } from "@/components/ui/IconButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageLayout } from "@/components/ui/PageLayout";
import { TabNav } from "@/components/ui/TabNav";
import { RefreshCw, Plus, User, FileText, Wrench, Sparkles } from "lucide-preact";
import type { RouteProps } from "@/types/routes";

// State and actions
import {
  activeTab,
  selectedAgentId,
  agents,
  files,
  workspacePath,
  isLoading,
  error,
  skillsSearchQuery,
  loadAgents,
  loadFiles,
  loadToolsConfig,
  openCreateModal,
  refresh,
  selectTab,
  selectAgent,
  type AgentsTab,
} from "./agent-state";

// Components
import { AgentSelector } from "./AgentSelector";
import { OverviewTab } from "./tabs/OverviewTab";
import { FilesTab } from "./tabs/FilesTab";
import { ToolsTab } from "./tabs/ToolsTab";
import { SkillsTab } from "./tabs/SkillsTab";
import { CreateAgentModal } from "./modals/CreateAgentModal";
import { DeleteAgentModal } from "./modals/DeleteAgentModal";

// ============================================
// Tab Configuration
// ============================================

const AGENT_TABS = [
  { id: "overview", label: "common.overview", icon: <User class="w-4 h-4" /> },
  { id: "files", label: "common.files", icon: <FileText class="w-4 h-4" /> },
  { id: "tools", label: "common.tools", icon: <Wrench class="w-4 h-4" /> },
  { id: "skills", label: "common.skills", icon: <Sparkles class="w-4 h-4" /> },
] as const;

// ============================================
// Main View
// ============================================

export function AgentsView(_props: RouteProps) {
  // URL query params
  const agentsReady = !isLoading.value && agents.value.length > 0;
  const [agentParam, setAgentParam] = useQueryParam("agent");
  const [tabParam, setTabParam] = useQueryParam("tab");
  const [searchParam, setSearchParam] = useQueryParam("q");

  // Sync URL → state on mount
  useInitFromParam(agentParam, selectedAgentId, (s) => s);
  useInitFromParam(tabParam, activeTab, (s) => s as AgentsTab);
  useInitFromParam(searchParam, skillsSearchQuery, (s) => s);

  // Sync state → URL (omit defaults from URL)
  useSyncFilterToParam(selectedAgentId, setAgentParam, "main");
  useSyncFilterToParam(activeTab, setTabParam, "overview");

  // Only sync search when on skills tab
  useEffect(() => {
    if (activeTab.value === "skills") {
      setSearchParam(skillsSearchQuery.value || null);
    } else if (searchParam.value) {
      // Clear search param when leaving skills tab
      setSearchParam(null);
    }
  }, [skillsSearchQuery.value, activeTab.value]);

  // If URL has agent param, select it once agents load
  useEffect(() => {
    if (agentsReady && agentParam.value) {
      const agent = agents.value.find((a) => a.id === agentParam.value);
      if (agent && selectedAgentId.value !== agent.id) {
        selectAgent(agent.id);
      }
    }
  }, [agentParam.value, agentsReady]);

  useEffect(() => {
    if (isConnected.value) {
      loadAgents().then(() => {
        loadFiles();
        loadToolsConfig(); // Load config for model info on overview
      });
    }
  }, [isConnected.value]);

  const tab = activeTab.value;

  return (
    <PageLayout viewName={t("common.agents")}>
      <PageHeader
        title={t("common.agents")}
        subtitle={t("agents.description")}
        actions={
          <div class="flex items-center gap-3">
            <AgentSelector />
            <IconButton
              icon={<Plus class="w-4 h-4" />}
              label={t("common.createAgent")}
              onClick={openCreateModal}
              disabled={!isConnected.value}
              variant="ghost"
            />
            <IconButton
              icon={<RefreshCw class={`w-4 h-4 ${isLoading.value ? "animate-spin" : ""}`} />}
              label={t("actions.refresh")}
              onClick={refresh}
              disabled={isLoading.value || !isConnected.value}
              variant="ghost"
            />
          </div>
        }
      />

      <TabNav
        items={AGENT_TABS.map((tab) => ({ ...tab, label: t(tab.label) }))}
        activeId={tab}
        onChange={(id) => selectTab(id as AgentsTab)}
      />

      {error.value && (
        <div class="p-4 rounded-xl bg-[var(--color-error)]/10 text-[var(--color-error)]">
          {error.value}
        </div>
      )}

      {isLoading.value && files.value.length === 0 ? (
        <div class="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {tab === "overview" && <OverviewTab />}
          {tab === "files" && <FilesTab />}
          {tab === "tools" && <ToolsTab />}
          {tab === "skills" && <SkillsTab />}
        </>
      )}

      {workspacePath.value && (
        <p class="text-xs text-[var(--color-text-muted)] text-center">{workspacePath.value}</p>
      )}

      {/* Modals */}
      <CreateAgentModal />
      <DeleteAgentModal />
    </PageLayout>
  );
}
