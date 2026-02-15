/**
 * ClawHubBrowser
 *
 * Browse and install skills from ClawHub registry.
 * Features: trending carousel, search, sort, URL sync, mobile modal.
 */

import { signal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { t, formatTimestamp } from "@/lib/i18n";
import { toast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Input } from "@/components/ui/Input";
import { Dropdown } from "@/components/ui/Dropdown";
import { Modal } from "@/components/ui/Modal";
import { HintBox } from "@/components/ui/HintBox";
import {
  Search,
  Download,
  Star,
  ExternalLink,
  Globe,
  Calendar,
  Flame,
  ChevronRight,
  X,
  User,
  MessageCircle,
  ArrowUpCircle,
} from "lucide-preact";
import {
  listSkills,
  searchSkills,
  getSkill,
  type ClawHubSkill,
  type ClawHubSort,
} from "@/lib/clawhub";
import { getErrorMessage } from "@/lib/session-utils";
import {
  useQueryParam,
  useSyncToParam,
  useSyncFilterToParam,
  useInitFromParam,
  pushQueryState,
} from "@/hooks/useQueryParam";

// ============================================
// State (exported for parent access)
// ============================================

const skills = signal<ClawHubSkill[]>([]);
const trendingSkills = signal<ClawHubSkill[]>([]);
export const clawHubLoading = signal(false);
const isTrendingLoading = signal(false);
const error = signal<string | null>(null);
const searchQuery = signal("");
const sortOrder = signal<ClawHubSort>("downloads");
const nextCursor = signal<string | undefined>(undefined);

// Detail modal
const detailModal = signal<ClawHubSkill | null>(null);
const isInstalling = signal(false);

// ============================================
// Sort options
// ============================================

const SORT_OPTIONS = [
  { value: "downloads", label: () => t("skills.clawhub.sortPopular") },
  { value: "trending", label: () => t("skills.clawhub.sortTrending") },
  { value: "stars", label: () => t("skills.clawhub.sortStars") },
  { value: "recent", label: () => t("skills.clawhub.sortRecent") },
] as const;

// ============================================
// Actions
// ============================================

async function loadTrending(): Promise<void> {
  if (isTrendingLoading.value) return;
  isTrendingLoading.value = true;

  try {
    const result = await listSkills({ limit: 6, sort: "trending" });
    trendingSkills.value = result.items;
  } catch {
    // Silently fail for trending - not critical
  } finally {
    isTrendingLoading.value = false;
  }
}

async function loadSkills(append = false): Promise<void> {
  if (clawHubLoading.value) return;

  clawHubLoading.value = true;
  error.value = null;

  try {
    const cursor = append ? nextCursor.value : undefined;

    if (searchQuery.value) {
      // Search doesn't support pagination
      const result = await searchSkills(searchQuery.value, { limit: 20 });
      skills.value = result.items;
      nextCursor.value = undefined;

      // Fetch full details for each search result to get stats
      const enriched = await Promise.all(
        result.items.map(async (item) => {
          try {
            const full = await getSkill(item.slug);
            return full || item;
          } catch {
            return item;
          }
        }),
      );
      skills.value = enriched;
    } else {
      const result = await listSkills({ limit: 20, cursor, sort: sortOrder.value });
      if (append) {
        skills.value = [...skills.value, ...result.items];
      } else {
        skills.value = result.items;
      }
      nextCursor.value = result.nextCursor;
    }
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    clawHubLoading.value = false;
  }
}

/** Exported refresh function for parent components */
export function refreshClawHub(): void {
  loadTrending();
  loadSkills();
}

async function installSkill(skill: ClawHubSkill): Promise<void> {
  isInstalling.value = true;

  try {
    // TODO: Once OpenClaw supports ClawHub installation, this will work.
    toast.error(t("skills.clawhub.notYetSupported", { slug: skill.slug }));
    detailModal.value = null;
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    isInstalling.value = false;
  }
}

function openDetailModal(skill: ClawHubSkill): void {
  detailModal.value = skill;
  pushQueryState();
}

// ============================================
// Sub-Components
// ============================================

function TrendingCarousel() {
  const items = trendingSkills.value;

  if (isTrendingLoading.value && items.length === 0) {
    return (
      <div class="flex items-center justify-center py-8">
        <Spinner size="md" />
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <section class="space-y-3">
      <div class="flex items-center gap-2">
        <Flame class="w-5 h-5 text-orange-500" />
        <h2 class="font-semibold">{t("skills.clawhub.trending")}</h2>
      </div>
      <div class="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
        {items.map((skill) => (
          <TrendingCard key={skill.slug} skill={skill} />
        ))}
      </div>
    </section>
  );
}

function TrendingCard({ skill }: { skill: ClawHubSkill }) {
  const version = skill.tags?.latest || skill.latestVersion?.version || "?";

  return (
    <button
      type="button"
      onClick={() => openDetailModal(skill)}
      style={{ outline: "none" }}
      class="flex-shrink-0 w-56 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-hover)] transition-colors text-left group cursor-pointer"
    >
      <div class="flex items-center gap-2 mb-1">
        <span class="font-medium truncate flex-1">{skill.displayName}</span>
        <Badge variant="default" class="flex-shrink-0 text-xs">
          {version}
        </Badge>
      </div>
      <p class="text-xs text-[var(--color-text-muted)] line-clamp-2 mb-2 min-h-[2.5em]">
        {skill.summary || t("skills.clawhub.noDescription")}
      </p>
      <div class="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
        <span class="flex items-center gap-1">
          <Download class="w-3 h-3" />
          {formatNumber(skill.stats.downloads)}
        </span>
        <span class="flex items-center gap-1">
          <Star class="w-3 h-3" />
          {skill.stats.stars}
        </span>
        <ChevronRight class="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </button>
  );
}

function SkillCard({ skill }: { skill: ClawHubSkill }) {
  const version = skill.tags?.latest || skill.latestVersion?.version || "?";

  return (
    <Card class="hover:border-[var(--color-border-hover)] transition-colors">
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => openDetailModal(skill)}
          style={{ outline: "none" }}
          class="flex-1 min-w-0 text-left cursor-pointer"
        >
          <div class="flex items-center gap-2 mb-1 flex-wrap">
            <h3 class="font-semibold truncate">{skill.displayName}</h3>
            <Badge variant="default">{version}</Badge>
          </div>
          <p
            class="text-sm text-[var(--color-text-muted)] line-clamp-2 mb-3"
            title={skill.summary || undefined}
          >
            {skill.summary || t("skills.clawhub.noDescription")}
          </p>
          <div class="flex items-center gap-3 sm:gap-4 text-xs text-[var(--color-text-muted)] flex-wrap">
            <span class="flex items-center gap-1">
              <Download class="w-3 h-3" />
              {formatNumber(skill.stats.downloads)}
            </span>
            <span class="flex items-center gap-1">
              <Star class="w-3 h-3" />
              {skill.stats.stars}
            </span>
            <span class="flex items-center gap-1">
              <Calendar class="w-3 h-3" />
              {formatTimestamp(skill.updatedAt)}
            </span>
          </div>
        </button>
        <Button
          variant="secondary"
          size="sm"
          icon={<Download class="w-4 h-4" />}
          onClick={() => openDetailModal(skill)}
          class="self-start sm:flex-shrink-0"
        >
          {t("skills.clawhub.install")}
        </Button>
      </div>
    </Card>
  );
}

function DetailModal() {
  const skill = detailModal.value;
  if (!skill) return null;

  const version = skill.tags?.latest || skill.latestVersion?.version || "?";
  const changelog = skill.latestVersion?.changelog;

  const footerContent = (
    <div class="flex items-center justify-between gap-3">
      <Button
        variant="secondary"
        icon={<ExternalLink class="w-4 h-4" />}
        onClick={() => window.open(`https://clawhub.ai/skills/${skill.slug}`, "_blank")}
      >
        ClawHub
      </Button>
      <div class="flex gap-3">
        <Button
          variant="secondary"
          onClick={() => {
            detailModal.value = null;
          }}
          disabled={isInstalling.value}
        >
          {t("actions.cancel")}
        </Button>
        <Button
          variant="primary"
          icon={<Download class="w-4 h-4" />}
          onClick={() => installSkill(skill)}
          disabled={isInstalling.value}
        >
          {isInstalling.value ? t("skills.clawhub.installing") : t("skills.clawhub.install")}
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      open={true}
      onClose={() => {
        detailModal.value = null;
      }}
      title={skill.displayName}
      footer={footerContent}
      size="lg"
    >
      <div class="space-y-5">
        {/* Summary */}
        {skill.summary && <p class="text-[var(--color-text-muted)]">{skill.summary}</p>}

        {/* Stats row */}
        <div class="flex items-center gap-4 flex-wrap text-sm">
          <span class="flex items-center gap-1.5">
            <Star class="w-4 h-4 text-yellow-500" />
            <span class="font-medium">{skill.stats.stars}</span>
          </span>
          <span class="flex items-center gap-1.5 text-[var(--color-text-muted)]">
            <Download class="w-4 h-4" />
            {formatNumber(skill.stats.downloads)}
          </span>
          {skill.stats.installsCurrent !== undefined && (
            <span class="flex items-center gap-1.5 text-[var(--color-text-muted)]">
              <ArrowUpCircle class="w-4 h-4" />
              {skill.stats.installsCurrent} {t("skills.clawhub.installs")}
            </span>
          )}
          {skill.stats.comments > 0 && (
            <span class="flex items-center gap-1.5 text-[var(--color-text-muted)]">
              <MessageCircle class="w-4 h-4" />
              {skill.stats.comments}
            </span>
          )}
        </div>

        {/* Author */}
        {skill.owner && (
          <div class="flex items-center gap-2">
            <span class="text-sm text-[var(--color-text-muted)]">{t("skills.clawhub.by")}</span>
            {skill.owner.image ? (
              <img
                src={skill.owner.image}
                alt={skill.owner.displayName}
                class="w-5 h-5 rounded-full"
              />
            ) : (
              <User class="w-5 h-5 text-[var(--color-text-muted)]" />
            )}
            <span class="text-sm font-medium">@{skill.owner.handle}</span>
          </div>
        )}

        {/* Version & Updated */}
        <div class="flex items-center gap-4 flex-wrap text-sm text-[var(--color-text-muted)]">
          <Badge variant="default">{version}</Badge>
          <span class="flex items-center gap-1.5">
            <Calendar class="w-4 h-4" />
            {t("skills.clawhub.updated")} {formatTimestamp(skill.updatedAt)}
          </span>
        </div>

        {/* Changelog */}
        {changelog && (
          <div>
            <h4 class="text-sm font-medium mb-2">{t("skills.clawhub.changelog")}</h4>
            <div class="p-3 bg-[var(--color-bg-tertiary)] rounded-lg text-xs max-h-32 overflow-y-auto whitespace-pre-wrap font-mono">
              {changelog}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function EmptyState() {
  return (
    <div class="text-center py-12">
      <Globe class="w-12 h-12 mx-auto text-[var(--color-text-muted)] mb-4" />
      <h3 class="text-lg font-medium mb-2">{t("skills.clawhub.noResults")}</h3>
      <p class="text-[var(--color-text-muted)]">{t("skills.clawhub.tryDifferentSearch")}</p>
    </div>
  );
}

// ============================================
// Helpers
// ============================================

function formatNumber(n: number): string {
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(n);
}

// ============================================
// Main Component
// ============================================

export function ClawHubBrowser() {
  // URL sync
  const [searchParam, setSearchParam] = useQueryParam("hub_q");
  const [sortParam, setSortParam] = useQueryParam("hub_sort");
  const [skillParam, setSkillParam] = useQueryParam("hub_skill");

  // Init from URL
  useInitFromParam(searchParam, searchQuery, (s) => s);
  useInitFromParam(sortParam, sortOrder, (s) => s as ClawHubSort);

  // Sync to URL
  useSyncToParam(searchQuery, setSearchParam);
  useSyncFilterToParam(sortOrder, setSortParam, "downloads");

  // Sync skill param → modal
  useEffect(() => {
    if (skillParam.value && skills.value.length > 0) {
      const skill = skills.value.find((s) => s.slug === skillParam.value);
      if (skill && !detailModal.value) {
        detailModal.value = skill;
      }
    }
  }, [skillParam.value, skills.value]);

  // Sync modal → skill param
  useEffect(() => {
    setSkillParam(detailModal.value?.slug ?? null);
  }, [detailModal.value]);

  // Initial load (trending only - skills loaded by debounce effect)
  useEffect(() => {
    loadTrending();
  }, []);

  // Reload when sort changes (only for non-search)
  useEffect(() => {
    if (!searchQuery.value) {
      nextCursor.value = undefined;
      loadSkills();
    }
  }, [sortOrder.value]);

  // Debounced search on input
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    searchTimeout.current = setTimeout(() => {
      nextCursor.value = undefined;
      loadSkills();
    }, 300);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [searchQuery.value]);

  const hasMore = !!nextCursor.value;
  const showTrending = trendingSkills.value.length > 0;

  return (
    <div class="space-y-6">
      {/* Trending carousel */}
      {showTrending && <TrendingCarousel />}

      {/* Search + Sort */}
      <div class="flex items-center justify-between gap-2 sm:gap-3">
        <div class="min-w-0 w-full max-w-md">
          <Input
            type="text"
            placeholder={t("skills.clawhub.searchPlaceholder")}
            value={searchQuery.value}
            onInput={(e) => {
              searchQuery.value = (e.target as HTMLInputElement).value;
            }}
            leftElement={clawHubLoading.value ? <Spinner size="sm" /> : <Search class="w-4 h-4" />}
            fullWidth
            rightElement={
              searchQuery.value ? (
                <button
                  type="button"
                  onClick={() => {
                    searchQuery.value = "";
                  }}
                  class="p-1 hover:bg-[var(--color-bg-hover)] rounded-full transition-colors"
                  aria-label={t("actions.clear")}
                >
                  <X class="w-4 h-4" />
                </button>
              ) : undefined
            }
          />
        </div>
        <Dropdown
          value={sortOrder.value}
          onChange={(v) => {
            sortOrder.value = v as ClawHubSort;
          }}
          options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label() }))}
          size="sm"
          align="right"
          aria-label={t("skills.clawhub.sortLabel")}
        />
      </div>

      {/* Error */}
      {error.value && <HintBox variant="error">{error.value}</HintBox>}

      {/* Loading */}
      {clawHubLoading.value && skills.value.length === 0 && (
        <div class="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      )}

      {/* Skills list */}
      {skills.value.length > 0 && (
        <div class="grid gap-3">
          {skills.value.map((skill) => (
            <SkillCard key={skill.slug} skill={skill} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!clawHubLoading.value && !error.value && skills.value.length === 0 && <EmptyState />}

      {/* Load more */}
      {hasMore && !clawHubLoading.value && (
        <div class="flex justify-center">
          <Button variant="secondary" onClick={() => loadSkills(true)}>
            {t("actions.showMore")}
          </Button>
        </div>
      )}

      {/* Loading more indicator */}
      {clawHubLoading.value && skills.value.length > 0 && (
        <div class="flex justify-center py-4">
          <Spinner size="md" />
        </div>
      )}

      <DetailModal />
    </div>
  );
}
