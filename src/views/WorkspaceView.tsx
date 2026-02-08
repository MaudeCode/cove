/**
 * WorkspaceView
 *
 * List and manage agent workspace configuration files.
 */

import { signal, computed } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { estimateTokenCount } from "tokenx";
import { t, formatTimestampCompact, formatBytes, formatTokens } from "@/lib/i18n";
import { send, isConnected } from "@/lib/gateway";
import { toast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Dropdown } from "@/components/ui/Dropdown";
import { Spinner } from "@/components/ui/Spinner";
import { IconButton } from "@/components/ui/IconButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { HintBox } from "@/components/ui/HintBox";
import { RefreshCw, Pencil, Plus, AlertTriangle } from "lucide-preact";
import { ViewErrorBoundary } from "@/components/ui/ViewErrorBoundary";
import { route } from "preact-router";
import type { RouteProps } from "@/types/routes";
import type { WorkspaceFile, WorkspaceFilesResult } from "@/types/workspace";
import type { Agent, AgentsListResponse } from "@/types/agents";
import {
  WORKSPACE_FILE_META,
  WORKSPACE_FILE_ORDER,
  WORKSPACE_FILES_OPTIONAL,
  normalizeWorkspaceFilename,
} from "@/types/workspace";

// ============================================
// State
// ============================================

const agents = signal<Agent[]>([]);
const selectedAgentId = signal<string>("main");
const files = signal<WorkspaceFile[]>([]);
const workspacePath = signal<string>("");
const isLoading = signal<boolean>(false);
const error = signal<string | null>(null);

// ============================================
// Helpers
// ============================================

/** Format agent display name with emoji */
function formatAgentName(agent: Agent): string {
  const name = agent.identity?.name || agent.id;
  return agent.identity?.emoji ? `${agent.identity.emoji}\u00A0\u00A0${name}` : name;
}

/** Get token count for a file (from content if available, otherwise estimate from size) */
function getFileTokens(file: WorkspaceFile): number {
  if (file.missing) return 0;
  if (file.content) return estimateTokenCount(file.content);
  // Fallback: estimate ~4 bytes per token for markdown
  if (file.size != null) return Math.round(file.size / 4);
  return 0;
}

// De-duplicated agents (by workspace path or display name, keep first occurrence)
const uniqueAgents = computed(() => {
  const seen = new Set<string>();
  return agents.value.filter((agent) => {
    const key = agent.workspace || formatAgentName(agent);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
});

// Total tokens across all non-missing files
const totalTokens = computed(() => {
  return files.value.reduce((sum, file) => sum + getFileTokens(file), 0);
});

// ============================================
// Actions
// ============================================

async function loadAgents(): Promise<void> {
  try {
    const result = await send<AgentsListResponse>("agents.list", {});
    agents.value = result.agents;
    // Default to first agent if current selection not in list
    if (!result.agents.find((a) => a.id === selectedAgentId.value)) {
      selectedAgentId.value = result.defaultId || result.agents[0]?.id || "main";
    }
  } catch {
    // Fallback to main agent
    agents.value = [{ id: "main", name: "Main" }];
  }
}

async function loadFiles(): Promise<void> {
  isLoading.value = true;
  error.value = null;

  try {
    const result = await send<WorkspaceFilesResult>("agents.files.list", {
      agentId: selectedAgentId.value,
    });
    files.value = result.files;
    workspacePath.value = result.workspace;
  } catch (err) {
    error.value = err instanceof Error ? err.message : t("workspace.loadError");
    toast.error(t("workspace.loadError"));
  } finally {
    isLoading.value = false;
  }
}

function selectAgent(agentId: string): void {
  selectedAgentId.value = agentId;
  loadFiles();
}

function openFile(filename: string): void {
  route(`/workspace/${encodeURIComponent(filename)}?agent=${selectedAgentId.value}`);
}

// ============================================
// Components
// ============================================

function FileCard({ file }: { file: WorkspaceFile }) {
  const normalizedName = normalizeWorkspaceFilename(file.name);
  const meta = WORKSPACE_FILE_META[normalizedName] ?? {
    icon: "📄",
    description: "workspace.files.unknown",
  };
  const isOptional = WORKSPACE_FILES_OPTIONAL.includes(normalizedName);
  const showMissingWarning = file.missing && !isOptional;
  const tokens = getFileTokens(file);

  return (
    <Card
      padding="md"
      class="hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
      onClick={() => openFile(file.name)}
    >
      <div class="flex items-center gap-4">
        {/* Icon */}
        <div class="text-2xl flex-shrink-0" aria-hidden="true">
          {meta.icon}
        </div>

        {/* Content */}
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-medium">{file.name}</span>
            {showMissingWarning && (
              <Badge variant="warning" size="sm">
                <AlertTriangle class="w-3 h-3 mr-1" />
                {t("workspace.missing")}
              </Badge>
            )}
          </div>
          <p class="text-sm text-[var(--color-text-muted)] truncate">{t(meta.description)}</p>
          {/* Mobile-only metadata row */}
          {!file.missing && (file.size != null || file.updatedAtMs) && (
            <div class="sm:hidden text-xs text-[var(--color-text-muted)] mt-0.5">
              {file.size != null && formatBytes(file.size)}
              {tokens > 0 && ` · ${formatTokens(tokens)} tokens`}
              {file.updatedAtMs && ` · ${formatTimestampCompact(file.updatedAtMs)}`}
            </div>
          )}
        </div>

        {/* Desktop metadata - right aligned */}
        {!file.missing && (
          <div class="hidden sm:flex items-center gap-4 text-sm text-[var(--color-text-muted)] tabular-nums">
            <span class="w-16 text-right">{file.size != null && formatBytes(file.size)}</span>
            <span class="w-24 text-right">{tokens > 0 && `${formatTokens(tokens)} tokens`}</span>
            <span class="w-12 text-right">
              {file.updatedAtMs && formatTimestampCompact(file.updatedAtMs)}
            </span>
          </div>
        )}

        {/* Action */}
        <IconButton
          icon={file.missing ? <Plus class="w-4 h-4" /> : <Pencil class="w-4 h-4" />}
          label={file.missing ? t("workspace.create") : t("workspace.edit")}
          onClick={(e) => {
            e.stopPropagation();
            openFile(file.name);
          }}
          variant="ghost"
        />
      </div>
    </Card>
  );
}

// ============================================
// Main View
// ============================================

export function WorkspaceView(_props: RouteProps) {
  useEffect(() => {
    if (isConnected.value) {
      loadAgents().then(() => loadFiles());
    }
  }, [isConnected.value]);

  // Sort files by predefined order
  const sortedFiles = [...files.value].sort((a, b) => {
    const aName = normalizeWorkspaceFilename(a.name);
    const bName = normalizeWorkspaceFilename(b.name);
    const aIndex = WORKSPACE_FILE_ORDER.indexOf(aName);
    const bIndex = WORKSPACE_FILE_ORDER.indexOf(bName);
    // Unknown files go to end
    const aOrder = aIndex === -1 ? 999 : aIndex;
    const bOrder = bIndex === -1 ? 999 : bIndex;
    return aOrder - bOrder;
  });

  // Build dropdown options from unique agents
  const agentOptions = uniqueAgents.value.map((agent) => ({
    value: agent.id,
    label: formatAgentName(agent),
  }));

  const showAgentSwitcher = uniqueAgents.value.length > 1;

  return (
    <ViewErrorBoundary viewName={t("nav.workspace")}>
      <div class="flex-1 overflow-y-auto p-4 sm:p-6">
        <div class="max-w-4xl mx-auto space-y-6">
          <PageHeader
            title={t("workspace.title")}
            subtitle={t("workspace.description")}
            actions={
              <div class="flex items-center gap-2">
                {showAgentSwitcher && (
                  <Dropdown
                    value={selectedAgentId.value}
                    options={agentOptions}
                    onChange={selectAgent}
                    size="sm"
                    aria-label={t("workspace.selectAgent")}
                  />
                )}
                <IconButton
                  icon={<RefreshCw class={`w-4 h-4 ${isLoading.value ? "animate-spin" : ""}`} />}
                  label={t("actions.refresh")}
                  onClick={() => loadFiles()}
                  disabled={isLoading.value || !isConnected.value}
                  variant="ghost"
                />
              </div>
            }
          />

          {/* Error */}
          {error.value && (
            <div class="p-4 rounded-xl bg-[var(--color-error)]/10 text-[var(--color-error)]">
              {error.value}
            </div>
          )}

          {/* Loading */}
          {isLoading.value && files.value.length === 0 ? (
            <div class="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : (
            <>
              {/* File List */}
              <div class="space-y-2">
                {sortedFiles.map((file) => (
                  <FileCard key={file.name} file={file} />
                ))}
              </div>

              {/* Total tokens */}
              {totalTokens.value > 0 && (
                <div class="flex justify-center">
                  <Badge variant="default" size="md">
                    {t("workspace.totalTokens", { count: formatTokens(totalTokens.value) })}
                  </Badge>
                </div>
              )}

              {/* Hint about memory folder */}
              <HintBox title={t("workspace.memoryHint.title")}>
                <ul class="list-disc list-inside space-y-1 text-sm">
                  <li>{t("workspace.memoryHint.line1")}</li>
                  <li>{t("workspace.memoryHint.line2")}</li>
                </ul>
              </HintBox>

              {/* Workspace path */}
              {workspacePath.value && (
                <p class="text-xs text-[var(--color-text-muted)] text-center">
                  {workspacePath.value}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </ViewErrorBoundary>
  );
}
