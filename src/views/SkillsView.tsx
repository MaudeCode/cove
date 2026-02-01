/**
 * SkillsView
 *
 * Skills browser and management.
 * Route: /skills
 */

import { signal, computed } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { t } from "@/lib/i18n";
import { send, isConnected } from "@/lib/gateway";
import { getErrorMessage } from "@/lib/session-utils";
import { toast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { IconButton } from "@/components/ui/IconButton";
import { StatCard } from "@/components/ui/StatCard";
import { Modal } from "@/components/ui/Modal";
import { Toggle } from "@/components/ui/Toggle";
import { Input } from "@/components/ui/Input";
import {
  RefreshCw,
  Search,
  Puzzle,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Download,
  Package,
  Folder,
  FolderCog,
  ShieldOff,
} from "lucide-preact";
import type { SkillStatusReport, SkillStatusEntry, SkillStatus, SkillSource } from "@/types/skills";
import { getSkillStatus, hasMissingRequirements, getMissingSummary } from "@/types/skills";
import type { RouteProps } from "@/types/routes";

// ============================================
// Local State
// ============================================

const skills = signal<SkillStatusEntry[]>([]);
const workspaceDir = signal<string>("");
const managedSkillsDir = signal<string>("");
const isLoading = signal<boolean>(false);
const error = signal<string | null>(null);

// Search and filters
const searchQuery = signal<string>("");
const sourceFilter = signal<SkillSource | "all">("all");
const statusFilter = signal<SkillStatus | "all">("all");

// Expanded rows
const expandedSkills = signal<Set<string>>(new Set());

// Install modal
const installModal = signal<SkillStatusEntry | null>(null);
const isInstalling = signal<boolean>(false);

// ============================================
// Computed Values
// ============================================

const filteredSkills = computed(() => {
  let result = skills.value;

  // Search filter
  const query = searchQuery.value.toLowerCase().trim();
  if (query) {
    result = result.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query) ||
        s.skillKey.toLowerCase().includes(query),
    );
  }

  // Source filter
  if (sourceFilter.value !== "all") {
    result = result.filter((s) => s.source === sourceFilter.value);
  }

  // Status filter
  if (statusFilter.value !== "all") {
    result = result.filter((s) => getSkillStatus(s) === statusFilter.value);
  }

  return result;
});

const stats = computed(() => {
  const all = skills.value;
  return {
    total: all.length,
    eligible: all.filter((s) => getSkillStatus(s) === "eligible").length,
    disabled: all.filter((s) => s.disabled).length,
    missingReqs: all.filter((s) => getSkillStatus(s) === "missing-reqs").length,
  };
});

// ============================================
// Actions
// ============================================

async function loadSkills(): Promise<void> {
  isLoading.value = true;
  error.value = null;

  try {
    const result = await send<SkillStatusReport>("skills.status", {});
    skills.value = result.skills;
    workspaceDir.value = result.workspaceDir;
    managedSkillsDir.value = result.managedSkillsDir;
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    isLoading.value = false;
  }
}

async function toggleSkillEnabled(skill: SkillStatusEntry): Promise<void> {
  const newEnabled = skill.disabled;

  try {
    await send("skills.update", {
      skillKey: skill.skillKey,
      enabled: newEnabled,
    });

    // Update local state
    skills.value = skills.value.map((s) =>
      s.skillKey === skill.skillKey ? { ...s, disabled: !newEnabled } : s,
    );

    const message = newEnabled
      ? t("skills.enabledSuccess", { name: skill.name })
      : t("skills.disabledSuccess", { name: skill.name });
    toast.success(message);
  } catch (err) {
    toast.error(getErrorMessage(err));
  }
}

async function installSkill(skill: SkillStatusEntry, installId: string): Promise<void> {
  isInstalling.value = true;

  try {
    const result = await send<{ ok: boolean; message?: string }>("skills.install", {
      name: skill.name,
      installId,
      timeoutMs: 60000,
    });

    if (result.ok) {
      toast.success(t("skills.installSuccess", { name: skill.name }));
      installModal.value = null;
      await loadSkills(); // Refresh to update status
    } else {
      toast.error(result.message || t("skills.installFailed"));
    }
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    isInstalling.value = false;
  }
}

function toggleExpanded(skillKey: string): void {
  const next = new Set(expandedSkills.value);
  if (next.has(skillKey)) {
    next.delete(skillKey);
  } else {
    next.add(skillKey);
  }
  expandedSkills.value = next;
}

function clearFilters(): void {
  searchQuery.value = "";
  sourceFilter.value = "all";
  statusFilter.value = "all";
}

// ============================================
// Status Helpers
// ============================================

function getStatusBadge(status: SkillStatus) {
  switch (status) {
    case "eligible":
      return { variant: "success" as const, label: t("skills.status.eligible") };
    case "disabled":
      return { variant: "default" as const, label: t("skills.status.disabled") };
    case "missing-reqs":
      return { variant: "warning" as const, label: t("skills.status.missingReqs") };
    case "blocked":
      return { variant: "error" as const, label: t("skills.status.blocked") };
  }
}

function getSourceBadge(source: SkillSource) {
  switch (source) {
    case "bundled":
      return { icon: Package, label: t("skills.source.bundled") };
    case "managed":
      return { icon: FolderCog, label: t("skills.source.managed") };
    case "workspace":
      return { icon: Folder, label: t("skills.source.workspace") };
    default:
      return { icon: Puzzle, label: source || "Unknown" };
  }
}

// ============================================
// Components
// ============================================

function SkillRow({ skill }: { skill: SkillStatusEntry }) {
  const status = getSkillStatus(skill);
  const statusBadge = getStatusBadge(status);
  const sourceBadge = getSourceBadge(skill.source);
  const SourceIcon = sourceBadge.icon;
  const isExpanded = expandedSkills.value.has(skill.skillKey);
  const missing = getMissingSummary(skill);
  const hasInstallOptions = skill.install.length > 0;

  return (
    <div class="border-b border-[var(--color-border)] last:border-b-0">
      {/* Main row */}
      <div
        class="flex items-center gap-4 px-4 py-3 hover:bg-[var(--color-bg-tertiary)] cursor-pointer"
        role="button"
        tabIndex={0}
        onClick={() => toggleExpanded(skill.skillKey)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleExpanded(skill.skillKey);
          }
        }}
      >
        {/* Expand/collapse icon */}
        <button
          type="button"
          class="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          aria-label={isExpanded ? t("actions.collapse") : t("actions.expand")}
        >
          {isExpanded ? <ChevronDown class="w-4 h-4" /> : <ChevronRight class="w-4 h-4" />}
        </button>

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
          <div class="text-sm text-[var(--color-text-muted)] truncate">{skill.description}</div>
        </div>

        {/* Source */}
        <div class="hidden md:flex items-center gap-1 text-sm text-[var(--color-text-muted)]">
          <SourceIcon class="w-4 h-4" />
          <span>{sourceBadge.label}</span>
        </div>

        {/* Status badge */}
        <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>

        {/* Enable/disable toggle */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
        <span role="presentation" onClick={(e) => e.stopPropagation()}>
          <Toggle
            checked={!skill.disabled}
            onChange={() => toggleSkillEnabled(skill)}
            size="sm"
            aria-label={skill.disabled ? t("skills.enable") : t("skills.disable")}
          />
        </span>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div class="px-4 py-3 bg-[var(--color-bg-tertiary)] border-t border-[var(--color-border)]">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {/* Left column: File path & source info */}
            <div class="space-y-2">
              <div>
                <span class="text-[var(--color-text-muted)]">{t("skills.skillKey")}:</span>{" "}
                <code class="text-xs bg-[var(--color-bg-primary)] px-1 py-0.5 rounded">
                  {skill.skillKey}
                </code>
              </div>
              <div>
                <span class="text-[var(--color-text-muted)]">{t("skills.location")}:</span>{" "}
                <span class="text-xs break-all">{skill.filePath}</span>
              </div>
              {skill.homepage && (
                <div>
                  <a
                    href={skill.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1 text-[var(--color-accent)] hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {t("skills.homepage")}
                    <ExternalLink class="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            {/* Right column: Requirements & install */}
            <div class="space-y-2">
              {/* Missing requirements */}
              {missing.length > 0 && (
                <div>
                  <span class="text-[var(--color-warning)] font-medium">
                    {t("skills.missingRequirements")}:
                  </span>
                  <ul class="list-disc list-inside text-xs mt-1 space-y-0.5">
                    {missing.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Blocked by allowlist */}
              {skill.blockedByAllowlist && (
                <div class="flex items-center gap-2 text-[var(--color-error)]">
                  <ShieldOff class="w-4 h-4" />
                  <span>{t("skills.blockedByAllowlist")}</span>
                </div>
              )}

              {/* Install options */}
              {hasInstallOptions && hasMissingRequirements(skill) && (
                <div class="pt-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Download}
                    onClick={(e) => {
                      e.stopPropagation();
                      installModal.value = skill;
                    }}
                  >
                    {t("skills.installDeps")}
                  </Button>
                </div>
              )}

              {/* Primary env hint */}
              {skill.primaryEnv && (
                <div class="text-xs text-[var(--color-text-muted)]">
                  {t("skills.primaryEnv")}: <code>{skill.primaryEnv}</code>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InstallModal() {
  const skill = installModal.value;
  if (!skill) return null;

  return (
    <Modal
      open={true}
      onClose={() => {
        installModal.value = null;
      }}
      title={t("skills.installTitle", { name: skill.name })}
    >
      <div class="space-y-4">
        <p class="text-sm text-[var(--color-text-muted)]">{t("skills.installDescription")}</p>

        <div class="space-y-2">
          {skill.install.map((option) => (
            <button
              key={option.id}
              type="button"
              class="w-full flex items-center gap-3 p-3 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] transition-colors text-left"
              onClick={() => installSkill(skill, option.id)}
              disabled={isInstalling.value}
            >
              <Download class="w-5 h-5 text-[var(--color-accent)]" />
              <div class="flex-1">
                <div class="font-medium">{option.label}</div>
                {option.bins.length > 0 && (
                  <div class="text-xs text-[var(--color-text-muted)]">
                    {t("skills.providesBins")}: {option.bins.join(", ")}
                  </div>
                )}
              </div>
              {isInstalling.value && <Spinner size="sm" />}
            </button>
          ))}
        </div>
      </div>

      <div class="mt-6 flex justify-end">
        <Button
          variant="secondary"
          onClick={() => {
            installModal.value = null;
          }}
        >
          {t("actions.cancel")}
        </Button>
      </div>
    </Modal>
  );
}

function EmptyState() {
  const hasFilters =
    searchQuery.value || sourceFilter.value !== "all" || statusFilter.value !== "all";

  if (hasFilters) {
    return (
      <div class="text-center py-12">
        <Search class="w-12 h-12 mx-auto text-[var(--color-text-muted)] mb-4" />
        <h3 class="text-lg font-medium mb-2">{t("skills.noResults")}</h3>
        <p class="text-[var(--color-text-muted)] mb-4">{t("skills.noResultsDescription")}</p>
        <Button variant="secondary" onClick={clearFilters}>
          {t("skills.clearFilters")}
        </Button>
      </div>
    );
  }

  return (
    <div class="text-center py-12">
      <Puzzle class="w-12 h-12 mx-auto text-[var(--color-text-muted)] mb-4" />
      <h3 class="text-lg font-medium mb-2">{t("skills.emptyTitle")}</h3>
      <p class="text-[var(--color-text-muted)]">{t("skills.emptyDescription")}</p>
    </div>
  );
}

// ============================================
// Main View
// ============================================

export function SkillsView(_props: RouteProps) {
  // Load skills on mount
  useEffect(() => {
    if (isConnected.value) {
      loadSkills();
    }
  }, [isConnected.value]);

  const filtered = filteredSkills.value;
  const s = stats.value;

  return (
    <div class="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold">{t("skills.title")}</h1>
          <p class="text-[var(--color-text-muted)]">{t("skills.description")}</p>
        </div>
        <IconButton
          icon={<RefreshCw class={isLoading.value ? "animate-spin" : ""} />}
          onClick={loadSkills}
          disabled={isLoading.value}
          label={t("actions.refresh")}
        />
      </div>

      {/* Error state */}
      {error.value && (
        <Card class="border-[var(--color-error)] bg-[var(--color-error)]/10">
          <div class="flex items-center gap-3 text-[var(--color-error)]">
            <AlertTriangle class="w-5 h-5 flex-shrink-0" />
            <span>{error.value}</span>
          </div>
        </Card>
      )}

      {/* Loading state */}
      {isLoading.value && skills.value.length === 0 && (
        <div class="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      )}

      {/* Main content */}
      {!isLoading.value && !error.value && (
        <>
          {/* Stat cards */}
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={Puzzle}
              label={t("skills.stats.total")}
              value={s.total}
              active={statusFilter.value === "all"}
              onClick={() => {
                statusFilter.value = "all";
              }}
            />
            <StatCard
              icon={CheckCircle}
              label={t("skills.stats.eligible")}
              value={s.eligible}
              active={statusFilter.value === "eligible"}
              onClick={() => {
                statusFilter.value = "eligible";
              }}
            />
            <StatCard
              icon={XCircle}
              label={t("skills.stats.disabled")}
              value={s.disabled}
              active={statusFilter.value === "disabled"}
              onClick={() => {
                statusFilter.value = "disabled";
              }}
            />
            <StatCard
              icon={AlertTriangle}
              label={t("skills.stats.missingReqs")}
              value={s.missingReqs}
              active={statusFilter.value === "missing-reqs"}
              highlight={s.missingReqs > 0}
              onClick={() => {
                statusFilter.value = "missing-reqs";
              }}
            />
          </div>

          {/* Filters */}
          <div class="flex flex-col sm:flex-row gap-4">
            <div class="flex-1">
              <Input
                type="text"
                placeholder={t("skills.searchPlaceholder")}
                value={searchQuery.value}
                onInput={(e) => {
                  searchQuery.value = (e.target as HTMLInputElement).value;
                }}
                leftElement={<Search class="w-4 h-4" />}
              />
            </div>
            <div class="flex gap-2">
              <select
                class="px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-sm"
                value={sourceFilter.value}
                onChange={(e) => {
                  sourceFilter.value = (e.target as HTMLSelectElement).value as SkillSource | "all";
                }}
              >
                <option value="all">{t("skills.filters.allSources")}</option>
                <option value="bundled">{t("skills.source.bundled")}</option>
                <option value="managed">{t("skills.source.managed")}</option>
                <option value="workspace">{t("skills.source.workspace")}</option>
              </select>
            </div>
          </div>

          {/* Results count */}
          {filtered.length !== s.total && (
            <p class="text-sm text-[var(--color-text-muted)]">
              {t("skills.filteredCount", { filtered: filtered.length, total: s.total })}
            </p>
          )}

          {/* Skills list */}
          <Card padding="none">
            {filtered.length === 0 ? (
              <EmptyState />
            ) : (
              <div>
                {filtered.map((skill) => (
                  <SkillRow key={skill.skillKey} skill={skill} />
                ))}
              </div>
            )}
          </Card>

          {/* Workspace info */}
          {workspaceDir.value && (
            <div class="text-xs text-[var(--color-text-muted)] space-y-1">
              <div>
                {t("skills.workspaceDir")}: <code>{workspaceDir.value}</code>
              </div>
              <div>
                {t("skills.managedDir")}: <code>{managedSkillsDir.value}</code>
              </div>
            </div>
          )}
        </>
      )}

      {/* Install modal */}
      <InstallModal />
    </div>
  );
}
