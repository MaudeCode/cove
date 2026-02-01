/**
 * Skills Types
 *
 * Types for the skills.status gateway method response.
 */

export type SkillSource = "bundled" | "managed" | "workspace";

export interface SkillConfigCheck {
  path: string;
  value: unknown;
  satisfied: boolean;
}

export interface SkillInstallOption {
  id: string;
  kind: "brew" | "node" | "go" | "uv" | "download";
  label: string;
  bins: string[];
}

export interface SkillRequirements {
  bins: string[];
  anyBins: string[];
  env: string[];
  config: string[];
  os: string[];
}

export interface SkillStatusEntry {
  name: string;
  description: string;
  source: SkillSource;
  filePath: string;
  baseDir: string;
  skillKey: string;
  primaryEnv?: string;
  emoji?: string;
  homepage?: string;
  always: boolean;
  disabled: boolean;
  blockedByAllowlist: boolean;
  eligible: boolean;
  requirements: SkillRequirements;
  missing: SkillRequirements;
  configChecks: SkillConfigCheck[];
  install: SkillInstallOption[];
}

export interface SkillStatusReport {
  workspaceDir: string;
  managedSkillsDir: string;
  skills: SkillStatusEntry[];
}

/** Skill status for display */
export type SkillStatus = "eligible" | "disabled" | "missing-reqs" | "blocked";

/** Get display status for a skill */
export function getSkillStatus(skill: SkillStatusEntry): SkillStatus {
  if (skill.disabled) return "disabled";
  if (skill.blockedByAllowlist) return "blocked";
  if (!skill.eligible) return "missing-reqs";
  return "eligible";
}

/** Check if a skill has any missing requirements */
export function hasMissingRequirements(skill: SkillStatusEntry): boolean {
  const { missing } = skill;
  return (
    missing.bins.length > 0 ||
    missing.anyBins.length > 0 ||
    missing.env.length > 0 ||
    missing.config.length > 0 ||
    missing.os.length > 0
  );
}

/** Get a summary of missing requirements */
export function getMissingSummary(skill: SkillStatusEntry): string[] {
  const items: string[] = [];
  const { missing } = skill;

  if (missing.bins.length > 0) {
    items.push(`bins: ${missing.bins.join(", ")}`);
  }
  if (missing.anyBins.length > 0) {
    items.push(`needs one of: ${missing.anyBins.join(", ")}`);
  }
  if (missing.env.length > 0) {
    items.push(`env: ${missing.env.join(", ")}`);
  }
  if (missing.config.length > 0) {
    items.push(`config: ${missing.config.join(", ")}`);
  }
  if (missing.os.length > 0) {
    items.push(`os: ${missing.os.join(", ")}`);
  }

  return items;
}
