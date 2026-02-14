/**
 * OverviewTab
 *
 * Agent overview with identity display and edit capabilities.
 */

import { t } from "@/lib/i18n";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { IconButton } from "@/components/ui/IconButton";
import { Pencil, Trash2 } from "lucide-preact";
import { AgentAvatar } from "@/components/agents/AgentAvatar";
import {
  selectedAgent,
  selectedAgentId,
  defaultAgentId,
  workspacePath,
  overviewEditing,
  overviewSaving,
  editName,
  editAvatar,
  editWorkspace,
  editModel,
  getAgentModel,
  startOverviewEdit,
  cancelOverviewEdit,
  saveOverviewEdit,
  openDeleteModal,
} from "../agent-state";

export function OverviewTab() {
  const agent = selectedAgent.value;
  if (!agent) return null;

  const isDefault = agent.id === defaultAgentId.value;
  const identityName = agent.identity?.name || agent.name || agent.id;
  const identityEmoji = agent.identity?.emoji || "🤖";
  const isEditing = overviewEditing.value;
  const currentModel = getAgentModel(agent.id);

  return (
    <div class="space-y-4">
      <Card>
        <div class="p-4">
          {isEditing ? (
            <div class="space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="edit-name"
                    class="text-xs text-[var(--color-text-muted)] uppercase tracking-wide"
                  >
                    {t("agents.overview.identityName")}
                  </label>
                  <Input
                    id="edit-name"
                    type="text"
                    value={editName.value}
                    onInput={(e) => (editName.value = (e.target as HTMLInputElement).value)}
                    placeholder={t("agents.overview.namePlaceholder")}
                    class="mt-1"
                    fullWidth
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-avatar"
                    class="text-xs text-[var(--color-text-muted)] uppercase tracking-wide"
                  >
                    {t("agents.overview.avatar")}
                  </label>
                  <Input
                    id="edit-avatar"
                    type="text"
                    value={editAvatar.value}
                    onInput={(e) => (editAvatar.value = (e.target as HTMLInputElement).value)}
                    placeholder={t("agents.overview.avatarPlaceholder")}
                    class="mt-1"
                    fullWidth
                  />
                </div>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="edit-workspace"
                    class="text-xs text-[var(--color-text-muted)] uppercase tracking-wide"
                  >
                    {t("agents.overview.workspace")}
                  </label>
                  <Input
                    id="edit-workspace"
                    type="text"
                    value={editWorkspace.value}
                    onInput={(e) => (editWorkspace.value = (e.target as HTMLInputElement).value)}
                    placeholder={t("agents.overview.workspacePlaceholder")}
                    class="mt-1 font-mono text-sm"
                    fullWidth
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-model"
                    class="text-xs text-[var(--color-text-muted)] uppercase tracking-wide"
                  >
                    {t("agents.overview.model")}
                  </label>
                  <Input
                    id="edit-model"
                    type="text"
                    value={editModel.value}
                    onInput={(e) => (editModel.value = (e.target as HTMLInputElement).value)}
                    placeholder={t("agents.overview.modelPlaceholder")}
                    class="mt-1 font-mono text-sm"
                    fullWidth
                  />
                </div>
              </div>
              <p class="text-xs text-[var(--color-text-muted)]">{t("agents.overview.editHint")}</p>
              <div class="flex gap-2">
                <button
                  type="button"
                  onClick={saveOverviewEdit}
                  disabled={overviewSaving.value}
                  class="px-3 py-1.5 text-sm font-medium bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
                >
                  {overviewSaving.value ? t("actions.saving") : t("actions.save")}
                </button>
                <button
                  type="button"
                  onClick={cancelOverviewEdit}
                  disabled={overviewSaving.value}
                  class="px-3 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] rounded-lg"
                >
                  {t("actions.cancel")}
                </button>
              </div>
            </div>
          ) : (
            <div class="flex items-center gap-4">
              {/* Avatar */}
              <AgentAvatar agentId={agent.id} emoji={identityEmoji} size="lg" />

              {/* Name + Emoji + Metadata */}
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <h3 class="text-lg font-semibold truncate">{identityName}</h3>
                  <span class="text-xl" title={t("agents.overview.identityEmoji")}>
                    {identityEmoji}
                  </span>
                  {isDefault && (
                    <Badge variant="info" size="sm">
                      {t("agents.overview.isDefault")}
                    </Badge>
                  )}
                </div>
                <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-1 text-sm text-[var(--color-text-muted)]">
                  <span class="font-mono truncate" title={workspacePath.value}>
                    {workspacePath.value || "—"}
                  </span>
                  {currentModel && (
                    <>
                      <span class="hidden sm:inline">•</span>
                      <span class="truncate" title={currentModel}>
                        {currentModel}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div class="flex items-center gap-1">
                <IconButton
                  icon={<Pencil class="w-4 h-4" />}
                  label={t("actions.edit")}
                  onClick={startOverviewEdit}
                  variant="ghost"
                />
                {selectedAgentId.value !== "main" && (
                  <IconButton
                    icon={<Trash2 class="w-4 h-4" />}
                    label={t("actions.delete")}
                    onClick={openDeleteModal}
                    variant="ghost"
                    class="text-[var(--color-error)] hover:bg-[var(--color-error)]/10"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
