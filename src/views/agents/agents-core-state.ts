import { signal, computed } from "@preact/signals";
import { send } from "@/lib/gateway";
import { getErrorMessage } from "@/lib/session-utils";
import { toast } from "@/components/ui/Toast";
import { t } from "@/lib/i18n";
import { formatAgentName } from "@/types/agents";
import type { WorkspaceFile } from "@/types/workspace";
import type { Agent } from "@/types/agents";

export type AgentsTab = "overview" | "files" | "tools" | "skills";

export const agents = signal<Agent[]>([]);
export const defaultAgentId = signal<string>("main");
export const selectedAgentId = signal<string>("main");
export const activeTab = signal<AgentsTab>("overview");
export const files = signal<WorkspaceFile[]>([]);
export const workspacePath = signal<string>("");
export const isLoading = signal<boolean>(false);
export const error = signal<string | null>(null);

export const overviewEditing = signal<boolean>(false);
export const overviewSaving = signal<boolean>(false);
export const editName = signal<string>("");
export const editAvatar = signal<string>("");
export const editWorkspace = signal<string>("");
export const editModel = signal<string>("");

export const agentSelectorOpen = signal<boolean>(false);

export const createModalOpen = signal<boolean>(false);
export const createName = signal<string>("");
export const createWorkspace = signal<string>("");
export const createEmoji = signal<string>("");
export const createSaving = signal<boolean>(false);

export const deleteModalOpen = signal<boolean>(false);
export const deleteConfirmText = signal<string>("");
export const deleteIncludeFiles = signal<boolean>(false);
export const deleteDeleting = signal<boolean>(false);

export const uniqueAgents = computed(() => {
  const seen = new Set<string>();
  return agents.value.filter((agent) => {
    const key = agent.workspace || formatAgentName(agent);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
});

export const selectedAgent = computed(() => {
  return agents.value.find((a) => a.id === selectedAgentId.value) ?? null;
});

export async function loadAgents(): Promise<void> {
  try {
    const result = await send("agents.list", {});
    agents.value = result.agents;
    defaultAgentId.value = result.defaultId;
    if (!result.agents.find((a) => a.id === selectedAgentId.value)) {
      selectedAgentId.value = result.defaultId || result.agents[0]?.id || "main";
    }
  } catch {
    agents.value = [{ id: "main", name: "Main" }];
  }
}

export async function loadFiles(): Promise<void> {
  isLoading.value = true;
  error.value = null;

  try {
    const result = await send("agents.files.list", {
      agentId: selectedAgentId.value,
    });
    files.value = result.files;
    workspacePath.value = result.workspace;
  } catch (err) {
    error.value = getErrorMessage(err);
    toast.error(t("agents.files.loadError"));
  } finally {
    isLoading.value = false;
  }
}
