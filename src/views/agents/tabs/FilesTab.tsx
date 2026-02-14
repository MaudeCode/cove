/**
 * FilesTab
 *
 * Agent workspace files list with edit actions.
 */

import { computed } from "@preact/signals";
import { estimateTokenCount } from "tokenx";
import { t, formatTimestampCompact, formatBytes, formatTokens } from "@/lib/i18n";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";
import { HintBox } from "@/components/ui/HintBox";
import { Pencil, Plus, AlertTriangle } from "lucide-preact";
import type { WorkspaceFile } from "@/types/workspace";
import {
  WORKSPACE_FILE_META,
  WORKSPACE_FILE_ORDER,
  WORKSPACE_FILES_OPTIONAL,
  normalizeWorkspaceFilename,
} from "@/types/workspace";
import { files, openFile } from "../agent-state";

// ============================================
// Helpers
// ============================================

function getFileTokens(file: WorkspaceFile): number {
  if (file.missing) return 0;
  if (file.content) return estimateTokenCount(file.content);
  if (file.size != null) return Math.round(file.size / 4);
  return 0;
}

const totalTokens = computed(() => {
  return files.value.reduce((sum, file) => sum + getFileTokens(file), 0);
});

// ============================================
// FileCard Component
// ============================================

function FileCard({ file }: { file: WorkspaceFile }) {
  const normalizedName = normalizeWorkspaceFilename(file.name);
  const meta = WORKSPACE_FILE_META[normalizedName] ?? {
    icon: "📄",
    description: "agents.files.meta.unknown",
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
        <div class="text-2xl flex-shrink-0" aria-hidden="true">
          {meta.icon}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-medium">{file.name}</span>
            {showMissingWarning && (
              <Badge variant="warning" size="sm">
                <AlertTriangle class="w-3 h-3 mr-1" />
                {t("agents.files.missing")}
              </Badge>
            )}
          </div>
          <p class="text-sm text-[var(--color-text-muted)] truncate">{t(meta.description)}</p>
          {!file.missing && (file.size != null || file.updatedAtMs) && (
            <div class="sm:hidden text-xs text-[var(--color-text-muted)] mt-0.5">
              {file.size != null && formatBytes(file.size)}
              {tokens > 0 && ` · ${formatTokens(tokens)} tokens`}
              {file.updatedAtMs && ` · ${formatTimestampCompact(file.updatedAtMs)}`}
            </div>
          )}
        </div>
        {!file.missing && (
          <div class="hidden sm:flex items-center gap-4 text-sm text-[var(--color-text-muted)] tabular-nums">
            <span class="w-16 text-right">{file.size != null && formatBytes(file.size)}</span>
            <span class="w-24 text-right">{tokens > 0 && `${formatTokens(tokens)} tokens`}</span>
            <span class="w-12 text-right">
              {file.updatedAtMs && formatTimestampCompact(file.updatedAtMs)}
            </span>
          </div>
        )}
        <IconButton
          icon={file.missing ? <Plus class="w-4 h-4" /> : <Pencil class="w-4 h-4" />}
          label={file.missing ? t("agents.files.create") : t("agents.files.edit")}
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
// FilesTab Component
// ============================================

export function FilesTab() {
  const sortedFiles = [...files.value].sort((a, b) => {
    const aName = normalizeWorkspaceFilename(a.name);
    const bName = normalizeWorkspaceFilename(b.name);
    const aIndex = WORKSPACE_FILE_ORDER.indexOf(aName);
    const bIndex = WORKSPACE_FILE_ORDER.indexOf(bName);
    const aOrder = aIndex === -1 ? 999 : aIndex;
    const bOrder = bIndex === -1 ? 999 : bIndex;
    return aOrder - bOrder;
  });

  return (
    <div class="space-y-4">
      <div class="space-y-2">
        {sortedFiles.map((file) => (
          <FileCard key={file.name} file={file} />
        ))}
      </div>
      {totalTokens.value > 0 && (
        <div class="flex justify-center">
          <Badge variant="default" size="md">
            {t("agents.files.totalTokens", { count: formatTokens(totalTokens.value) })}
          </Badge>
        </div>
      )}
      <HintBox title={t("agents.files.memoryHint.title")}>
        <ul class="list-disc list-inside space-y-1 text-sm">
          <li>{t("agents.files.memoryHint.line1")}</li>
          <li>{t("agents.files.memoryHint.line2")}</li>
        </ul>
      </HintBox>
    </div>
  );
}
