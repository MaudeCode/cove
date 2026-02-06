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
import { Spinner } from "@/components/ui/Spinner";
import { IconButton } from "@/components/ui/IconButton";
import { StatCard } from "@/components/ui/StatCard";
import { Input } from "@/components/ui/Input";
import { Dropdown } from "@/components/ui/Dropdown";
import { HintBox } from "@/components/ui/HintBox";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { RefreshCw, Search, Puzzle, CheckCircle, XCircle, AlertTriangle } from "lucide-preact";
import { ViewErrorBoundary } from "@/components/ui/ViewErrorBoundary";
import type { SkillStatusReport, SkillStatusEntry, SkillStatus, SkillSource } from "@/types/skills";
import { getSkillStatus } from "@/types/skills";
import {
  ClawHubBrowser,
  SkillRow,
  SkillCard,
  InstallDepsModal,
  SkillDetails,
} from "@/components/skills";
import type { RouteProps } from "@/types/routes";

// ============================================
// Constants
// ============================================

const SOURCE_OPTIONS = [
  { value: "all", label: () => t("skills.filters.allSources") },
  { value: "openclaw-bundled", label: () => t("skills.source.bundled") },
  { value: "openclaw-workspace", label: () => t("skills.source.workspace") },
  { value: "openclaw-managed", label: () => t("skills.source.managed") },
  { value: "openclaw-extra", label: () => t("skills.source.extra") },
] as const;

// ============================================
// State
// ============================================

type SkillsTab = "installed" | "clawhub";
const activeTab = signal<SkillsTab>("installed");

const skills = signal<SkillStatusEntry[]>([]);
const workspaceDir = signal("");
const managedSkillsDir = signal("");
const isLoading = signal(false);
const error = signal<string | null>(null);

// Filters
const searchQuery = signal("");
const sourceFilter = signal<SkillSource | "all">("all");
const statusFilter = signal<SkillStatus | "all">("all");

// UI state
const expandedSkills = signal<Set<string>>(new Set());
const installModal = signal<SkillStatusEntry | null>(null);
const mobileDetailModal = signal<SkillStatusEntry | null>(null);

// ============================================
// Computed
// ============================================

const stats = computed(() => {
  const all = skills.value;
  let eligible = 0;
  let disabled = 0;
  let missingReqs = 0;

  for (const skill of all) {
    const status = getSkillStatus(skill);
    if (status === "eligible") eligible++;
    else if (status === "disabled") disabled++;
    else if (status === "missing-reqs") missingReqs++;
  }

  return { total: all.length, eligible, disabled, missingReqs };
});

const filteredSkills = computed(() => {
  let result = skills.value;

  const query = searchQuery.value.toLowerCase().trim();
  if (query) {
    result = result.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query) ||
        s.skillKey.toLowerCase().includes(query),
    );
  }

  if (sourceFilter.value !== "all") {
    result = result.filter((s) => s.source === sourceFilter.value);
  }

  if (statusFilter.value !== "all") {
    result = result.filter((s) => getSkillStatus(s) === statusFilter.value);
  }

  return result;
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

    skills.value = skills.value.map((s) =>
      s.skillKey === skill.skillKey ? { ...s, disabled: !newEnabled } : s,
    );

    toast.success(
      newEnabled
        ? t("skills.enabledSuccess", { name: skill.name })
        : t("skills.disabledSuccess", { name: skill.name }),
    );
  } catch (err) {
    toast.error(getErrorMessage(err));
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
// Sub-Components
// ============================================

function TabButton({ tab, label, active }: { tab: SkillsTab; label: string; active: boolean }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => {
        activeTab.value = tab;
      }}
      class={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        active
          ? "bg-[var(--color-accent)] text-white"
          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]"
      }`}
    >
      {label}
    </button>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div class="text-center py-12">
      <Search class="w-12 h-12 mx-auto text-[var(--color-text-muted)] mb-4" />
      <h3 class="text-lg font-medium mb-2">
        {hasFilters ? t("skills.noResults") : t("skills.emptyTitle")}
      </h3>
      <p class="text-[var(--color-text-muted)] mb-4">
        {hasFilters ? t("skills.noResultsDescription") : t("skills.emptyDescription")}
      </p>
      {hasFilters && (
        <button
          type="button"
          onClick={clearFilters}
          class="text-[var(--color-accent)] hover:underline"
        >
          {t("skills.clearFilters")}
        </button>
      )}
    </div>
  );
}

// ============================================
// Main View
// ============================================

export function SkillsView(_props: RouteProps) {
  useEffect(() => {
    if (isConnected.value && activeTab.value === "installed") {
      loadSkills();
    }
  }, [isConnected.value]);

  const filtered = filteredSkills.value;
  const s = stats.value;
  const tab = activeTab.value;
  const hasFilters =
    !!searchQuery.value || sourceFilter.value !== "all" || statusFilter.value !== "all";

  return (
    <ViewErrorBoundary viewName={t("nav.skills")}>
      <div class="flex-1 overflow-y-auto p-4 sm:p-6">
        <div class="max-w-5xl mx-auto space-y-4 sm:space-y-6">
          <PageHeader
            title={t("skills.title")}
            subtitle={t("skills.description")}
            actions={
              tab === "installed" ? (
                <IconButton
                  icon={<RefreshCw class={isLoading.value ? "animate-spin" : ""} />}
                  onClick={loadSkills}
                  disabled={isLoading.value}
                  label={t("actions.refresh")}
                />
              ) : undefined
            }
          />

          {/* Tabs */}
          <div class="flex gap-2" role="tablist">
            <TabButton
              tab="installed"
              label={t("skills.tabs.installed")}
              active={tab === "installed"}
            />
            <TabButton tab="clawhub" label={t("skills.tabs.clawhub")} active={tab === "clawhub"} />
          </div>

          {/* ClawHub Tab */}
          {tab === "clawhub" && <ClawHubBrowser />}

          {/* Installed Tab */}
          {tab === "installed" && (
            <>
              {/* Error */}
              {error.value && <HintBox variant="error">{error.value}</HintBox>}

              {/* Loading */}
              {isLoading.value && skills.value.length === 0 && (
                <div class="flex items-center justify-center py-12">
                  <Spinner size="lg" />
                </div>
              )}

              {/* Content */}
              {!isLoading.value && !error.value && (
                <>
                  {/* Stats */}
                  <div class="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
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
                  <div class="space-y-3">
                    {/* Search row */}
                    <div class="flex items-center gap-3">
                      <Input
                        type="text"
                        placeholder={t("skills.searchPlaceholder")}
                        value={searchQuery.value}
                        onInput={(e) => {
                          searchQuery.value = (e.target as HTMLInputElement).value;
                        }}
                        leftElement={<Search class="w-4 h-4" />}
                        class="flex-1"
                      />
                      <Dropdown
                        value={sourceFilter.value}
                        onChange={(v) => {
                          sourceFilter.value = v as SkillSource | "all";
                        }}
                        options={SOURCE_OPTIONS.map((o) => ({ value: o.value, label: o.label() }))}
                        size="sm"
                        align="right"
                        aria-label={t("skills.filters.allSources")}
                      />
                    </div>
                    {/* Count */}
                    <p class="text-sm text-[var(--color-text-muted)]">
                      {filtered.length !== s.total
                        ? t("skills.filteredCount", { filtered: filtered.length, total: s.total })
                        : t("skills.count", { count: s.total })}
                    </p>
                  </div>

                  {/* Skills list - Cards on mobile, list on desktop */}
                  {filtered.length === 0 ? (
                    <Card padding="none">
                      <EmptyState hasFilters={hasFilters} />
                    </Card>
                  ) : (
                    <>
                      {/* Mobile: Card list */}
                      <div class="md:hidden space-y-2">
                        {filtered.map((skill) => (
                          <SkillCard
                            key={skill.skillKey}
                            skill={skill}
                            onToggleExpand={() => {
                              mobileDetailModal.value = skill;
                            }}
                            onToggleEnabled={() => toggleSkillEnabled(skill)}
                          />
                        ))}
                      </div>

                      {/* Desktop: Row list with expand/collapse */}
                      <Card padding="none" class="hidden md:block">
                        {filtered.map((skill) => (
                          <SkillRow
                            key={skill.skillKey}
                            skill={skill}
                            isExpanded={expandedSkills.value.has(skill.skillKey)}
                            onToggleExpand={() => toggleExpanded(skill.skillKey)}
                            onToggleEnabled={() => toggleSkillEnabled(skill)}
                            onInstall={(s) => {
                              installModal.value = s;
                            }}
                          />
                        ))}
                      </Card>
                    </>
                  )}

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
            </>
          )}

          {/* Mobile detail modal */}
          <Modal
            open={!!mobileDetailModal.value}
            onClose={() => {
              mobileDetailModal.value = null;
            }}
            title={mobileDetailModal.value?.name || ""}
          >
            {mobileDetailModal.value && (
              <SkillDetails
                skill={mobileDetailModal.value}
                onInstall={(s) => {
                  mobileDetailModal.value = null;
                  installModal.value = s;
                }}
                bare
              />
            )}
          </Modal>

          {/* Install modal */}
          <InstallDepsModal
            skill={installModal.value}
            onClose={() => {
              installModal.value = null;
            }}
            onSuccess={loadSkills}
          />
        </div>
      </div>
    </ViewErrorBoundary>
  );
}
