import { describe, expect, test } from "bun:test";
import {
  getMissingSummary,
  getSkillStatus,
  hasMissingRequirements,
  type SkillStatusEntry,
} from "../../../src/types/skills";

describe("skill type helpers", () => {
  test("computes status precedence for disabled, allowlist-blocked, missing, and eligible skills", () => {
    expect(
      getSkillStatus(skill({ disabled: true, blockedByAllowlist: true, eligible: false })),
    ).toBe("disabled");
    expect(getSkillStatus(skill({ blockedByAllowlist: true, eligible: false }))).toBe("blocked");
    expect(getSkillStatus(skill({ eligible: false }))).toBe("missing-reqs");
    expect(getSkillStatus(skill())).toBe("eligible");
  });

  test("detects and summarizes all missing requirement categories in stable order", () => {
    const entry = skill({
      missing: {
        bins: ["git"],
        anyBins: ["pnpm", "npm"],
        env: ["TOKEN"],
        config: ["providers.openai"],
        os: ["darwin"],
      },
    });

    expect(hasMissingRequirements(entry)).toBe(true);
    expect(getMissingSummary(entry)).toEqual([
      "bins: git",
      "needs one of: pnpm, npm",
      "env: TOKEN",
      "config: providers.openai",
      "os: darwin",
    ]);
  });

  test("returns empty summaries when requirements are satisfied", () => {
    const entry = skill();

    expect(hasMissingRequirements(entry)).toBe(false);
    expect(getMissingSummary(entry)).toEqual([]);
  });
});

function skill(overrides: Partial<SkillStatusEntry> = {}): SkillStatusEntry {
  return {
    name: "Skill",
    description: "Does things",
    source: "openclaw-managed",
    filePath: "/skills/skill/SKILL.md",
    baseDir: "/skills/skill",
    skillKey: "skill",
    always: false,
    disabled: false,
    blockedByAllowlist: false,
    eligible: true,
    requirements: emptyRequirements(),
    missing: emptyRequirements(),
    configChecks: [],
    install: [],
    ...overrides,
  };
}

function emptyRequirements() {
  return {
    bins: [],
    anyBins: [],
    env: [],
    config: [],
    os: [],
  };
}
