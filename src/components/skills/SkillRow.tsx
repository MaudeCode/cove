/**
 * SkillRow & SkillCard
 *
 * List row (desktop) and card (mobile) components for displaying skills.
 */

import { t } from "@/lib/i18n";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { ListCard } from "@/components/ui/ListCard";
import { ChevronDown, ChevronRight, Package, Folder, FolderCog, Puzzle } from "lucide-preact";
import type { SkillStatusEntry, SkillSource, SkillStatus } from "@/types/skills";
import { getSkillStatus } from "@/types/skills";
import { SkillDetails } from "./SkillDetails";

// ============================================
// Constants
// ============================================

const SOURCE_ICONS: Record<string, typeof Package> = {
  "openclaw-bundled": Package,
  "openclaw-managed": FolderCog,
  "openclaw-workspace": Folder,
  "openclaw-extra": Folder,
};

const SOURCE_LABELS: Record<string, string> = {
  "openclaw-bundled": "skills.source.bundled",
  "openclaw-managed": "skills.source.managed",
  "openclaw-workspace": "skills.source.workspace",
  "openclaw-extra": "skills.source.extra",
};

// ============================================
// Helpers
// ============================================

function getStatusBadge(status: SkillStatus) {
  const variants: Record<
    SkillStatus,
    { variant: "success" | "default" | "warning" | "error"; key: string }
  > = {
    eligible: { variant: "success", key: "skills.status.eligible" },
    disabled: { variant: "default", key: "skills.status.disabled" },
    "missing-reqs": { variant: "warning", key: "skills.status.missingReqs" },
    blocked: { variant: "error", key: "skills.status.blocked" },
  };
  const { variant, key } = variants[status];
  return { variant, label: t(key) };
}

function getSourceIcon(source: SkillSource) {
  return SOURCE_ICONS[source] || Puzzle;
}

function getSourceLabel(source: SkillSource) {
  const key = SOURCE_LABELS[source];
  return key ? t(key) : source;
}

// ============================================
// Components
// ============================================

interface SkillCardProps {
  skill: SkillStatusEntry;
  onToggleExpand: () => void;
  onToggleEnabled: () => void;
}

/** Mobile card view for a skill (tap to expand) */
export function SkillCard({ skill, onToggleExpand, onToggleEnabled }: SkillCardProps) {
  const status = getSkillStatus(skill);
  const statusBadge = getStatusBadge(status);
  const SourceIcon = getSourceIcon(skill.source);

  return (
    <ListCard
      icon={() => <span class="text-lg">{skill.emoji || "🔧"}</span>}
      iconVariant={
        status === "eligible" ? "success" : status === "missing-reqs" ? "warning" : "default"
      }
      title={skill.name}
      subtitle={skill.description}
      badges={
        <>
          <Badge variant={statusBadge.variant} size="sm">
            {statusBadge.label}
          </Badge>
          {skill.always && (
            <span class="text-xs text-[var(--color-text-muted)]" title={t("skills.alwaysActive")}>
              ⚡
            </span>
          )}
        </>
      }
      meta={[{ icon: SourceIcon, value: getSourceLabel(skill.source) }]}
      actions={
        <div
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="presentation"
        >
          <Toggle
            checked={!skill.disabled}
            onChange={onToggleEnabled}
            size="sm"
            aria-label={skill.disabled ? t("skills.enable") : t("skills.disable")}
          />
        </div>
      }
      onClick={onToggleExpand}
    />
  );
}

interface SkillRowProps {
  skill: SkillStatusEntry;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleEnabled: () => void;
  onInstall: (skill: SkillStatusEntry) => void;
}

export function SkillRow({
  skill,
  isExpanded,
  onToggleExpand,
  onToggleEnabled,
  onInstall,
}: SkillRowProps) {
  const status = getSkillStatus(skill);
  const statusBadge = getStatusBadge(status);
  const SourceIcon = getSourceIcon(skill.source);

  return (
    <div class="border-b border-[var(--color-border)] last:border-b-0">
      {/* Row header - clickable to expand */}
      <button
        type="button"
        class="w-full flex items-center gap-4 px-4 py-3 hover:bg-[var(--color-bg-tertiary)] text-left"
        onClick={onToggleExpand}
        aria-expanded={isExpanded}
      >
        {/* Expand chevron */}
        <span class="text-[var(--color-text-muted)]">
          {isExpanded ? <ChevronDown class="w-4 h-4" /> : <ChevronRight class="w-4 h-4" />}
        </span>

        {/* Emoji */}
        <span class="text-xl w-8 text-center flex-shrink-0">{skill.emoji || "🔧"}</span>

        {/* Name & description */}
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-medium truncate">{skill.name}</span>
            {skill.always && (
              <span class="text-xs text-[var(--color-text-muted)]" title={t("skills.alwaysActive")}>
                ⚡
              </span>
            )}
          </div>
          <div class="text-sm text-[var(--color-text-muted)] truncate" title={skill.description}>
            {skill.description}
          </div>
        </div>

        {/* Source (hidden on mobile) */}
        <div class="hidden md:flex items-center gap-1 text-sm text-[var(--color-text-muted)]">
          <SourceIcon class="w-4 h-4" />
          <span>{getSourceLabel(skill.source)}</span>
        </div>

        {/* Status badge */}
        <div class="w-24 flex justify-end">
          <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
        </div>

        {/* Enable/disable toggle - stop propagation to prevent row expand */}
        <div
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="presentation"
        >
          <Toggle
            checked={!skill.disabled}
            onChange={onToggleEnabled}
            size="sm"
            aria-label={skill.disabled ? t("skills.enable") : t("skills.disable")}
          />
        </div>
      </button>

      {/* Expanded details */}
      {isExpanded && <SkillDetails skill={skill} onInstall={onInstall} />}
    </div>
  );
}
