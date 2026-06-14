import { signal } from "@preact/signals";
import { send } from "@/lib/gateway";
import { getErrorMessage } from "@/lib/session-utils";
import { toast } from "@/components/ui/Toast";
import { t } from "@/lib/i18n";
import type { SkillStatusEntry } from "@/types/skills";
import { selectedAgentId } from "./agents-core-state";
import { buildAgentSkillsConfig } from "./agents-config-utils";
import { applyGatewayConfig, gatewayConfig } from "./agents-tools-state";

export const skills = signal<SkillStatusEntry[]>([]);
export const skillsLoading = signal<boolean>(false);
export const skillsSearchQuery = signal<string>("");
export const skillsSaving = signal<boolean>(false);
export const skillsDirty = signal<boolean>(false);
export const agentSkillsAllowlist = signal<string[] | null>(null);
export const localSkillsAllowlist = signal<string[] | null>(null);

export function syncSkillsAllowlist(allowlist: string[] | null): void {
  const normalized = normalizeSkillsAllowlist(allowlist);
  agentSkillsAllowlist.value = normalized;
  localSkillsAllowlist.value = normalized ? [...normalized] : null;
  skillsDirty.value = false;
}

export async function loadSkills(): Promise<void> {
  skillsLoading.value = true;
  try {
    const result = await send("skills.status", {});
    skills.value = result.skills;
    const normalized = normalizeSkillsAllowlist(localSkillsAllowlist.value);
    agentSkillsAllowlist.value = normalized;
    localSkillsAllowlist.value = normalized ? [...normalized] : null;
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    skillsLoading.value = false;
  }
}

export function toggleSkillInAllowlist(skillName: string): void {
  const skillKey = getSkillAllowlistKey(skillName);
  const current = localSkillsAllowlist.value;

  if (current === null) {
    const allSkillKeys = getEligibleSkillKeys();
    localSkillsAllowlist.value = allSkillKeys.filter((key) => key !== skillKey);
  } else if (current.includes(skillKey)) {
    localSkillsAllowlist.value = current.filter((key) => key !== skillKey);
  } else {
    localSkillsAllowlist.value = [...current, skillKey];
  }
  skillsDirty.value = true;
}

export function clearSkillsAllowlist(): void {
  localSkillsAllowlist.value = null;
  skillsDirty.value = true;
}

export function disableAllSkills(): void {
  localSkillsAllowlist.value = [];
  skillsDirty.value = true;
}

export function enableAllSkills(): void {
  localSkillsAllowlist.value = getEligibleSkillKeys();
  skillsDirty.value = true;
}

export async function saveSkillsAllowlist(): Promise<void> {
  if (!gatewayConfig.value) return;

  skillsSaving.value = true;
  const submittedAllowlist = localSkillsAllowlist.value;
  try {
    const config = buildAgentSkillsConfig(
      gatewayConfig.value,
      selectedAgentId.value,
      submittedAllowlist,
    );

    await applyGatewayConfig(config);
    agentSkillsAllowlist.value = submittedAllowlist;
    if (skillsAllowlistsEqual(localSkillsAllowlist.value, submittedAllowlist)) {
      skillsDirty.value = false;
    }
    toast.success(t("actions.saved"));
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    skillsSaving.value = false;
  }
}

function getEligibleSkillKeys(): string[] {
  return skills.value.filter((s) => !s.disabled && s.eligible).map((s) => s.skillKey);
}

function normalizeSkillsAllowlist(allowlist: string[] | null): string[] | null {
  return allowlist?.map(getSkillAllowlistKey) ?? null;
}

function skillsAllowlistsEqual(left: string[] | null, right: string[] | null): boolean {
  return (
    JSON.stringify(normalizeAllowlistForCompare(left)) ===
    JSON.stringify(normalizeAllowlistForCompare(right))
  );
}

function normalizeAllowlistForCompare(allowlist: string[] | null): string[] | null {
  return allowlist ? [...allowlist].sort() : null;
}

function getSkillAllowlistKey(skillNameOrKey: string): string {
  return (
    skills.value.find((skill) => skill.name === skillNameOrKey || skill.skillKey === skillNameOrKey)
      ?.skillKey ?? skillNameOrKey
  );
}
