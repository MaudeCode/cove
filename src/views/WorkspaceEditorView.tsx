/**
 * AgentFileEditorView
 *
 * View and edit a single agent workspace file.
 * Route: /agents/edit/:filename
 */

import { signal, computed } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { route } from "preact-router";
import { t, formatTimestampCompact, formatBytes, formatTokens } from "@/lib/i18n";
import { estimateTokenCount } from "tokenx";
import { send, isConnected } from "@/lib/gateway";
import { toast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { IconButton } from "@/components/ui/IconButton";
import { Badge } from "@/components/ui/Badge";
import { Textarea } from "@/components/ui/Textarea";
import { MessageContent } from "@/components/chat/MessageContent";
import { ArrowLeft, Save, Eye, Pencil } from "lucide-preact";
import { ViewErrorBoundary } from "@/components/ui/ViewErrorBoundary";
import type { ComponentChildren } from "preact";
import type { RouteProps } from "@/types/routes";
import type { WorkspaceFileResult, WorkspaceFile } from "@/types/workspace";
import { WORKSPACE_FILE_META, normalizeWorkspaceFilename } from "@/types/workspace";

interface WorkspaceEditorViewProps extends RouteProps {
  /** Filename from URL param */
  filename?: string;
}

// ============================================
// State
// ============================================

const file = signal<WorkspaceFile | null>(null);
const currentAgentId = signal<string>("main");
const originalContent = signal<string>("");
const editedContent = signal<string>("");
const mode = signal<"view" | "edit">("view");
const isLoading = signal<boolean>(false);
const isSaving = signal<boolean>(false);
const error = signal<string | null>(null);

// Computed
const hasChanges = computed(() => editedContent.value !== originalContent.value);
const meta = computed(() => {
  const name = file.value?.name ?? "";
  const normalized = normalizeWorkspaceFilename(name);
  return (
    WORKSPACE_FILE_META[normalized] ?? {
      icon: "📄",
      description: "agents.files.meta.unknown",
    }
  );
});

// ============================================
// Helpers
// ============================================

function getAgentFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("agent") || "main";
}

// ============================================
// Actions
// ============================================

async function loadFile(filename: string, agentId: string): Promise<void> {
  isLoading.value = true;
  error.value = null;
  currentAgentId.value = agentId;

  try {
    const result = await send<WorkspaceFileResult>("agents.files.get", {
      agentId,
      name: filename,
    });
    file.value = result.file;
    const content = result.file.content ?? "";
    originalContent.value = content;
    editedContent.value = content;
    // Default to edit mode if file is missing/empty
    mode.value = result.file.missing || !content ? "edit" : "view";
  } catch (err) {
    error.value = err instanceof Error ? err.message : t("agents.files.loadFileError");
    toast.error(t("agents.files.loadFileError"));
  } finally {
    isLoading.value = false;
  }
}

async function saveFile(): Promise<void> {
  if (!file.value) return;

  isSaving.value = true;

  try {
    await send("agents.files.set", {
      agentId: currentAgentId.value,
      name: file.value.name,
      content: editedContent.value,
    });
    originalContent.value = editedContent.value;
    // Update file state
    file.value = {
      ...file.value,
      missing: false,
      content: editedContent.value,
      size: new Blob([editedContent.value]).size,
      updatedAtMs: Date.now(),
    };
    toast.success(t("agents.files.saved"));
  } catch {
    toast.error(t("agents.files.saveError"));
  } finally {
    isSaving.value = false;
  }
}

function goBack(): void {
  if (hasChanges.value) {
    const confirmed = window.confirm(t("agents.files.unsavedWarning"));
    if (!confirmed) return;
  }
  // Reset state
  file.value = null;
  originalContent.value = "";
  editedContent.value = "";
  mode.value = "view";
  route("/agents");
}

// ============================================
// Components
// ============================================

interface ModeTabProps {
  active: boolean;
  onClick: () => void;
  icon: ComponentChildren;
  label: string;
  indicator?: boolean;
}

function ModeTab({ active, onClick, icon, label, indicator }: ModeTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      class={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
        active
          ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
          : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
      }`}
    >
      {icon}
      {label}
      {indicator && <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-warning)]" />}
    </button>
  );
}

// ============================================
// Main View
// ============================================

export function WorkspaceEditorView({ filename }: WorkspaceEditorViewProps) {
  const decodedFilename = filename ? decodeURIComponent(filename) : "";

  useEffect(() => {
    if (isConnected.value && decodedFilename) {
      const agentId = getAgentFromUrl();
      loadFile(decodedFilename, agentId);
    }
  }, [isConnected.value, decodedFilename]);

  // Keyboard shortcut: Cmd/Ctrl+S to save
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (mode.value === "edit" && hasChanges.value && !isSaving.value) {
          saveFile();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <ViewErrorBoundary viewName={decodedFilename || t("nav.agents")}>
      <div class="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div class="flex items-center justify-between gap-4 px-4 sm:px-6 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <div class="flex items-center gap-3 min-w-0">
            <IconButton
              icon={<ArrowLeft class="w-4 h-4" />}
              label={t("agents.files.backToList")}
              onClick={goBack}
              variant="ghost"
            />
            <div class="flex items-center gap-2 min-w-0">
              <span class="text-xl" aria-hidden="true">
                {meta.value.icon}
              </span>
              <h1 class="font-semibold truncate">{filename}</h1>
              {hasChanges.value && (
                <Badge variant="warning" size="sm">
                  {t("agents.files.unsaved")}
                </Badge>
              )}
            </div>
          </div>

          <div class="flex items-center gap-2">
            {/* File info */}
            {file.value && !file.value.missing && (
              <span class="hidden sm:block text-sm text-[var(--color-text-muted)]">
                {file.value.size != null && formatBytes(file.value.size)}
                {editedContent.value && (
                  <>
                    {" • "}
                    {formatTokens(estimateTokenCount(editedContent.value))} tokens
                  </>
                )}
                {file.value.updatedAtMs && (
                  <>
                    {" • "}
                    {formatTimestampCompact(file.value.updatedAtMs)}
                  </>
                )}
              </span>
            )}

            {/* Save button */}
            {mode.value === "edit" && (
              <Button
                variant="primary"
                size="sm"
                icon={<Save class="w-4 h-4" />}
                onClick={saveFile}
                disabled={!hasChanges.value || isSaving.value}
              >
                {isSaving.value ? t("actions.saving") : t("actions.save")}
              </Button>
            )}
          </div>
        </div>

        {/* Mode tabs */}
        <div class="flex gap-1 px-4 sm:px-6 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]">
          <ModeTab
            active={mode.value === "view"}
            onClick={() => (mode.value = "view")}
            icon={<Eye class="w-4 h-4" />}
            label={t("agents.files.view")}
          />
          <ModeTab
            active={mode.value === "edit"}
            onClick={() => (mode.value = "edit")}
            icon={<Pencil class="w-4 h-4" />}
            label={t("agents.files.edit")}
            indicator={hasChanges.value}
          />
        </div>

        {/* Content */}
        <div class="flex-1 overflow-y-auto">
          {/* Error */}
          {error.value && (
            <div class="m-4 p-4 rounded-xl bg-[var(--color-error)]/10 text-[var(--color-error)]">
              {error.value}
            </div>
          )}

          {/* Loading */}
          {isLoading.value ? (
            <div class="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : mode.value === "view" ? (
            /* View mode - rendered markdown */
            <div class="p-4 sm:p-6 max-w-4xl mx-auto">
              {editedContent.value ? (
                <MessageContent content={editedContent.value} />
              ) : (
                <p class="text-[var(--color-text-muted)] italic">{t("agents.files.emptyFile")}</p>
              )}
            </div>
          ) : (
            /* Edit mode - textarea */
            <div class="p-4 sm:p-6 h-full">
              <Textarea
                value={editedContent.value}
                onInput={(e) => (editedContent.value = (e.target as HTMLTextAreaElement).value)}
                placeholder={t("agents.files.editPlaceholder")}
                class="font-mono text-sm h-full min-h-[400px] resize-none"
                fullWidth
              />
            </div>
          )}
        </div>
      </div>
    </ViewErrorBoundary>
  );
}
