/**
 * SkillDetails
 *
 * Expanded detail panel for a skill.
 */

import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { Download, ExternalLink, ShieldOff } from "lucide-preact";
import type { SkillStatusEntry } from "@/types/skills";
import { hasMissingRequirements, getMissingSummary } from "@/types/skills";

interface SkillDetailsProps {
  skill: SkillStatusEntry;
  onInstall: (skill: SkillStatusEntry) => void;
}

/** Simple label: value row */
function DetailRow({ label, children }: { label: string; children: preact.ComponentChildren }) {
  return (
    <div>
      <span class="text-[var(--color-text-muted)]">{label}:</span> {children}
    </div>
  );
}

export function SkillDetails({ skill, onInstall }: SkillDetailsProps) {
  const missing = getMissingSummary(skill);
  const hasInstallOptions = skill.install.length > 0 && hasMissingRequirements(skill);

  return (
    <div class="px-4 py-3 bg-[var(--color-bg-tertiary)] border-t border-[var(--color-border)]">
      {/* Full description */}
      <p class="text-sm text-[var(--color-text-secondary)] mb-4">{skill.description}</p>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        {/* Left column: Metadata */}
        <div class="space-y-2">
          <DetailRow label={t("skills.skillKey")}>
            <code class="text-xs bg-[var(--color-bg-primary)] px-1 py-0.5 rounded">
              {skill.skillKey}
            </code>
          </DetailRow>
          <DetailRow label={t("skills.location")}>
            <span class="text-xs break-all">{skill.filePath}</span>
          </DetailRow>
          {skill.homepage && (
            <div>
              <a
                href={skill.homepage}
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 text-[var(--color-accent)] hover:underline"
              >
                {t("skills.homepage")}
                <ExternalLink class="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        {/* Right column: Requirements & actions */}
        <div class="space-y-2">
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

          {skill.blockedByAllowlist && (
            <div class="flex items-center gap-2 text-[var(--color-error)]">
              <ShieldOff class="w-4 h-4" />
              <span>{t("skills.blockedByAllowlist")}</span>
            </div>
          )}

          {hasInstallOptions && (
            <div class="pt-2">
              <Button
                variant="secondary"
                size="sm"
                icon={Download}
                onClick={() => onInstall(skill)}
              >
                {t("skills.installDeps")}
              </Button>
            </div>
          )}

          {skill.primaryEnv && (
            <div class="text-xs text-[var(--color-text-muted)]">
              {t("skills.primaryEnv")}: <code>{skill.primaryEnv}</code>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
