/**
 * SkillsTab
 *
 * Configure skill access for the agent.
 */

import { t } from "@/lib/i18n";
import { route } from "preact-router";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";
import { Spinner } from "@/components/ui/Spinner";
import { IconButton } from "@/components/ui/IconButton";
import { HintBox } from "@/components/ui/HintBox";
import { RefreshCw, Search } from "lucide-preact";
import {
  skills,
  skillsLoading,
  skillsSearchQuery,
  skillsSaving,
  skillsDirty,
  localSkillsAllowlist,
  loadSkills,
  loadToolsConfig,
  toggleSkillInAllowlist,
  clearSkillsAllowlist,
  disableAllSkills,
  enableAllSkills,
  saveSkillsAllowlist,
} from "../agent-state";

// ============================================
// SkillsTab Component
// ============================================

export function SkillsTab() {
  // Only show eligible skills (not globally disabled or missing deps)
  const eligibleSkills = skills.value.filter((s) => !s.disabled && s.eligible);
  const allowlist = localSkillsAllowlist.value;
  const usingAllowlist = allowlist !== null;
  const allowSet = new Set(allowlist ?? []);

  // Filter skills by search
  const query = skillsSearchQuery.value.toLowerCase().trim();
  const filtered = query
    ? eligibleSkills.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query) ||
          s.skillKey.toLowerCase().includes(query),
      )
    : eligibleSkills;

  // Count how many skills this agent can use
  const allowedCount = usingAllowlist ? allowlist.length : eligibleSkills.length;

  function isSkillAllowed(skillName: string): boolean {
    if (!usingAllowlist) return true;
    return allowSet.has(skillName);
  }

  if (skillsLoading.value && skills.value.length === 0) {
    return (
      <div class="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div class="space-y-4">
      {/* Header Card */}
      <Card>
        <div class="p-4">
          <div class="flex items-center justify-between gap-4">
            <div>
              <h3 class="text-base font-semibold">{t("agents.skills.title")}</h3>
              <p class="text-sm text-[var(--color-text-muted)]">
                {usingAllowlist
                  ? t("agents.skills.usingAllowlist", {
                      allowed: allowedCount,
                      total: eligibleSkills.length,
                    })
                  : t("agents.skills.usingAll", { count: eligibleSkills.length })}
              </p>
            </div>
            <div class="flex items-center gap-2">
              {skillsDirty.value && (
                <button
                  type="button"
                  onClick={saveSkillsAllowlist}
                  disabled={skillsSaving.value}
                  class="px-3 py-1.5 text-sm font-medium bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
                >
                  {skillsSaving.value ? t("actions.saving") : t("actions.save")}
                </button>
              )}
              <IconButton
                icon={<RefreshCw class={skillsLoading.value ? "animate-spin" : ""} />}
                label={t("actions.refresh")}
                onClick={() => {
                  loadSkills();
                  loadToolsConfig();
                }}
                variant="ghost"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div class="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={clearSkillsAllowlist}
              disabled={!usingAllowlist}
              class={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                !usingAllowlist
                  ? "bg-[var(--color-accent)]/10 border-[var(--color-accent)] text-[var(--color-accent)]"
                  : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
              }`}
            >
              {t("agents.skills.useAll")}
            </button>
            <button
              type="button"
              onClick={enableAllSkills}
              class="px-3 py-1.5 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
            >
              {t("agents.skills.selectAll")}
            </button>
            <button
              type="button"
              onClick={disableAllSkills}
              class="px-3 py-1.5 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
            >
              {t("agents.skills.selectNone")}
            </button>
          </div>

          {/* Search */}
          <div class="mt-4 relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
            <Input
              id="skills-search"
              type="text"
              value={skillsSearchQuery.value}
              onInput={(e) => (skillsSearchQuery.value = (e.target as HTMLInputElement).value)}
              placeholder={t("agents.skills.searchPlaceholder")}
              class="pl-9"
              fullWidth
              aria-label={t("agents.skills.searchPlaceholder")}
            />
          </div>
        </div>
      </Card>

      {/* Skills List */}
      {filtered.length === 0 ? (
        <Card>
          <div class="p-8 text-center text-[var(--color-text-muted)]">
            {query ? t("agents.skills.noSearchResults") : t("agents.skills.noSkills")}
          </div>
        </Card>
      ) : (
        <Card padding="none">
          {filtered.map((skill) => {
            const allowed = isSkillAllowed(skill.name);

            return (
              <div
                key={skill.skillKey}
                class="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-bg-tertiary)]"
              >
                {/* Emoji */}
                <span class="text-xl w-8 text-center flex-shrink-0">{skill.emoji || "🔧"}</span>

                {/* Name & description */}
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="font-medium truncate">{skill.name}</span>
                    {skill.always && (
                      <span
                        class="text-xs text-[var(--color-text-muted)]"
                        title={t("agents.skills.alwaysActive")}
                      >
                        ⚡
                      </span>
                    )}
                  </div>
                  <p class="text-xs text-[var(--color-text-muted)] truncate">{skill.description}</p>
                </div>

                {/* View details link */}
                <a
                  href={`/skills?skill=${encodeURIComponent(skill.skillKey)}`}
                  onClick={(e) => {
                    e.preventDefault();
                    route(`/skills?skill=${encodeURIComponent(skill.skillKey)}`);
                  }}
                  class="text-xs text-[var(--color-accent)] hover:underline flex-shrink-0"
                >
                  {t("agents.skills.details")}
                </a>

                {/* Toggle */}
                <Toggle checked={allowed} onChange={() => toggleSkillInAllowlist(skill.name)} />
              </div>
            );
          })}
        </Card>
      )}

      <HintBox>
        <strong>{t("agents.skills.useAll")}</strong> {t("agents.skills.useAllHint")}
        <br />
        <strong>{t("agents.skills.selectSpecific")}</strong> {t("agents.skills.selectSpecificHint")}
        <br />
        {t("agents.skills.globalHint")}{" "}
        <a href="/skills" class="text-[var(--color-accent)] hover:underline">
          {t("nav.skills")}
        </a>{" "}
        {t("agents.skills.page")}.
      </HintBox>
    </div>
  );
}
