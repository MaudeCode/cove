/**
 * ClawHubBrowser
 *
 * Browse and install skills from ClawHub registry.
 * Note: Requires CORS headers on ClawHub API (pending PR).
 */

import { signal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { t, formatTimestamp } from "@/lib/i18n";
import { toast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { HintBox } from "@/components/ui/HintBox";
import { Search, Download, Star, ExternalLink, RefreshCw, Globe, Calendar } from "lucide-preact";
import { listSkills, searchSkills, type ClawHubSkill } from "@/lib/clawhub";
import { getErrorMessage } from "@/lib/session-utils";

// ============================================
// State
// ============================================

const skills = signal<ClawHubSkill[]>([]);
const isLoading = signal(false);
const error = signal<string | null>(null);
const searchQuery = signal("");
const nextCursor = signal<string | undefined>(undefined);

// Install modal
const installModal = signal<ClawHubSkill | null>(null);
const isInstalling = signal(false);

// ============================================
// Actions
// ============================================

async function loadSkills(append = false): Promise<void> {
  if (isLoading.value) return;

  isLoading.value = true;
  error.value = null;

  try {
    const cursor = append ? nextCursor.value : undefined;
    const result = searchQuery.value
      ? await searchSkills(searchQuery.value, { limit: 20 })
      : await listSkills({ limit: 20, cursor });

    if (append) {
      skills.value = [...skills.value, ...result.items];
    } else {
      skills.value = result.items;
    }
    nextCursor.value = result.nextCursor;
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    isLoading.value = false;
  }
}

async function doSearch(): Promise<void> {
  nextCursor.value = undefined;
  await loadSkills();
}

async function installSkill(skill: ClawHubSkill): Promise<void> {
  isInstalling.value = true;

  try {
    // TODO: Once OpenClaw supports ClawHub installation, this will work.
    // For now, show a helpful message about manual installation.
    toast.error(t("skills.clawhub.notYetSupported", { slug: skill.slug }));
    installModal.value = null;
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    isInstalling.value = false;
  }
}

// ============================================
// Sub-Components
// ============================================

function SkillCard({ skill }: { skill: ClawHubSkill }) {
  const version = skill.tags?.latest || skill.latestVersion?.version || "?";

  return (
    <Card class="hover:border-[var(--color-border-hover)] transition-colors">
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <h3 class="font-semibold truncate">{skill.displayName}</h3>
            <Badge variant="default">{version}</Badge>
          </div>
          <p
            class="text-sm text-[var(--color-text-muted)] line-clamp-2 mb-3"
            title={skill.summary || undefined}
          >
            {skill.summary || t("skills.clawhub.noDescription")}
          </p>
          <div class="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
            <span class="flex items-center gap-1">
              <Download class="w-3 h-3" />
              {skill.stats.downloads}
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
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={Download}
          onClick={() => {
            installModal.value = skill;
          }}
        >
          {t("skills.clawhub.install")}
        </Button>
      </div>
    </Card>
  );
}

function InstallModal() {
  const skill = installModal.value;
  if (!skill) return null;

  const version = skill.tags?.latest || skill.latestVersion?.version || "?";
  const changelog = skill.latestVersion?.changelog;

  return (
    <Modal
      open={true}
      onClose={() => {
        installModal.value = null;
      }}
      title={t("skills.clawhub.installTitle", { name: skill.displayName })}
    >
      <div class="space-y-4">
        <p class="text-sm text-[var(--color-text-muted)]">
          {t("skills.clawhub.installConfirm", { name: skill.displayName, version })}
        </p>

        {skill.summary && (
          <div class="p-3 bg-[var(--color-bg-tertiary)] rounded-lg text-sm">{skill.summary}</div>
        )}

        {changelog && (
          <div>
            <h4 class="text-sm font-medium mb-2">{t("skills.clawhub.changelog")}</h4>
            <div class="p-3 bg-[var(--color-bg-tertiary)] rounded-lg text-xs max-h-32 overflow-y-auto whitespace-pre-wrap">
              {changelog}
            </div>
          </div>
        )}

        <div class="flex items-center gap-4 text-sm text-[var(--color-text-muted)]">
          <span class="flex items-center gap-1">
            <Download class="w-4 h-4" />
            {skill.stats.downloads} {t("skills.clawhub.downloads")}
          </span>
          <span class="flex items-center gap-1">
            <Star class="w-4 h-4" />
            {skill.stats.stars} {t("skills.clawhub.stars")}
          </span>
        </div>

        <a
          href={`https://clawhub.ai/skills/${skill.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 text-sm text-[var(--color-accent)] hover:underline"
        >
          {t("skills.clawhub.viewOnClawhub")}
          <ExternalLink class="w-3 h-3" />
        </a>
      </div>

      <div class="mt-6 flex justify-end gap-3">
        <Button
          variant="secondary"
          onClick={() => {
            installModal.value = null;
          }}
          disabled={isInstalling.value}
        >
          {t("actions.cancel")}
        </Button>
        <Button
          variant="primary"
          icon={Download}
          onClick={() => installSkill(skill)}
          disabled={isInstalling.value}
        >
          {isInstalling.value ? t("skills.clawhub.installing") : t("skills.clawhub.install")}
        </Button>
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
// Main Component
// ============================================

export function ClawHubBrowser() {
  useEffect(() => {
    loadSkills();
  }, []);

  const hasMore = !!nextCursor.value;

  return (
    <div class="space-y-6">
      {/* Search */}
      <div class="flex items-center gap-4">
        <div class="flex-1">
          <Input
            type="text"
            placeholder={t("skills.clawhub.searchPlaceholder")}
            value={searchQuery.value}
            onInput={(e) => {
              searchQuery.value = (e.target as HTMLInputElement).value;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") doSearch();
            }}
            leftElement={<Search class="w-4 h-4" />}
          />
        </div>
        <Button variant="secondary" onClick={doSearch} disabled={isLoading.value}>
          {t("actions.search")}
        </Button>
        <IconButton
          icon={<RefreshCw class={isLoading.value ? "animate-spin" : ""} />}
          label={t("actions.refresh")}
          onClick={() => loadSkills()}
          disabled={isLoading.value}
        />
      </div>

      {/* Error */}
      {error.value && <HintBox variant="error">{error.value}</HintBox>}

      {/* Loading */}
      {isLoading.value && skills.value.length === 0 && (
        <div class="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      )}

      {/* Skills list */}
      {skills.value.length > 0 && (
        <div class="grid gap-4">
          {skills.value.map((skill) => (
            <SkillCard key={skill.slug} skill={skill} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading.value && !error.value && skills.value.length === 0 && <EmptyState />}

      {/* Load more */}
      {hasMore && !isLoading.value && (
        <div class="flex justify-center">
          <Button variant="secondary" onClick={() => loadSkills(true)}>
            {t("actions.showMore")}
          </Button>
        </div>
      )}

      {/* Loading more indicator */}
      {isLoading.value && skills.value.length > 0 && (
        <div class="flex justify-center py-4">
          <Spinner size="md" />
        </div>
      )}

      <InstallModal />
    </div>
  );
}
