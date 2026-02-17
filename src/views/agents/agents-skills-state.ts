import { signal } from "@preact/signals";
import { send } from "@/lib/gateway";
import { getErrorMessage } from "@/lib/session-utils";
import { toast } from "@/components/ui/Toast";
import { t } from "@/lib/i18n";
import type { SkillStatusReport, SkillStatusEntry } from "@/types/skills";
import { selectedAgentId } from "./agents-core-state";
import { gatewayConfig } from "./agents-tools-state";

export const skills = signal<SkillStatusEntry[]>([]);
export const skillsLoading = signal<boolean>(false);
export const skillsSearchQuery = signal<string>("");
export const skillsSaving = signal<boolean>(false);
export const skillsDirty = signal<boolean>(false);
export const agentSkillsAllowlist = signal<string[] | null>(null);
export const localSkillsAllowlist = signal<string[] | null>(null);

export function syncSkillsAllowlist(allowlist: string[] | null): void {
  agentSkillsAllowlist.value = allowlist;
  localSkillsAllowlist.value = allowlist ? [...allowlist] : null;
  skillsDirty.value = false;
}

export async function loadSkills(): Promise<void> {
  skillsLoading.value = true;
  try {
    const result = await send<SkillStatusReport>("skills.status", {});
    skills.value = result.skills;
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    skillsLoading.value = false;
  }
}

export function toggleSkillInAllowlist(skillName: string): void {
  const current = localSkillsAllowlist.value;

  if (current === null) {
    const allSkillNames = skills.value.filter((s) => !s.disabled && s.eligible).map((s) => s.name);
    localSkillsAllowlist.value = allSkillNames.filter((n) => n !== skillName);
  } else if (current.includes(skillName)) {
    localSkillsAllowlist.value = current.filter((n) => n !== skillName);
  } else {
    localSkillsAllowlist.value = [...current, skillName];
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
  const allSkillNames = skills.value.filter((s) => !s.disabled && s.eligible).map((s) => s.name);
  localSkillsAllowlist.value = allSkillNames;
  skillsDirty.value = true;
}

export async function saveSkillsAllowlist(): Promise<void> {
  if (!gatewayConfig.value) return;

  skillsSaving.value = true;
  try {
    const config = { ...gatewayConfig.value };
    const agentList = [...(config.agents?.list ?? [])];
    const agentIndex = agentList.findIndex((a) => a.id === selectedAgentId.value);

    const skillsUpdate = localSkillsAllowlist.value;

    if (agentIndex >= 0) {
      agentList[agentIndex] = { ...agentList[agentIndex], skills: skillsUpdate ?? undefined };
      if (skillsUpdate === null) {
        delete agentList[agentIndex].skills;
      }
    } else if (skillsUpdate !== null) {
      agentList.push({ id: selectedAgentId.value, skills: skillsUpdate });
    }

    config.agents = { ...config.agents, list: agentList };

    await send("config.apply", { config });
    gatewayConfig.value = config;
    agentSkillsAllowlist.value = localSkillsAllowlist.value;
    skillsDirty.value = false;
    toast.success(t("actions.saved"));
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    skillsSaving.value = false;
  }
}
