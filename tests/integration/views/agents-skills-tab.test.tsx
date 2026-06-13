/** @jsxImportSource preact */
import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { fireEvent, renderComponent, screen } from "../../helpers/dom";

mock.module("@/lib/i18n", () => ({
  t: (key: string) => key,
}));

mock.module("@/lib/gateway", () => ({
  send: () => {
    throw new Error("send is not used by SkillsTab render tests");
  },
}));

mock.module("@/lib/session-utils", () => ({
  getErrorMessage: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));

mock.module("@/components/ui/Toast", () => ({
  toast: {
    error: () => "error-toast",
    success: () => "success-toast",
  },
}));

mock.module("@/components/ui/Button", () => import("../../../src/components/ui/Button"));
mock.module("@/components/ui/Card", () => import("../../../src/components/ui/Card"));
mock.module("@/components/ui/HintBox", () => import("../../../src/components/ui/HintBox"));
mock.module("@/components/ui/IconButton", () => import("../../../src/components/ui/IconButton"));
mock.module("@/components/ui/Input", () => import("../../../src/components/ui/Input"));
mock.module("@/components/ui/Spinner", () => import("../../../src/components/ui/Spinner"));
mock.module("@/components/ui/Toggle", () => import("../../../src/components/ui/Toggle"));

mock.module("@/types/agents", () => ({
  formatAgentName: (agent: { id?: string; name?: string }) => agent.name ?? agent.id ?? "agent",
}));

mock.module("preact-router", () => ({
  route: () => undefined,
}));

const {
  localSkillsAllowlist,
  skills,
  skillsDirty,
  skillsLoading,
  skillsSaving,
  skillsSearchQuery,
} = await import("../../../src/views/agents/agents-skills-state");
const { SkillsTab } = await import("../../../src/views/agents/tabs/SkillsTab");

describe("SkillsTab", () => {
  afterAll(() => {
    mock.restore();
  });

  beforeEach(() => {
    skills.value = [];
    skillsLoading.value = false;
    skillsSaving.value = false;
    skillsDirty.value = false;
    skillsSearchQuery.value = "";
    localSkillsAllowlist.value = null;
  });

  test("renders key-based allowlist entries as enabled and toggles by skill key", () => {
    skills.value = [skillFixture({ name: "Code", skillKey: "code-key" })];
    localSkillsAllowlist.value = ["code-key"];

    renderComponent(<SkillsTab />);

    const toggle = screen.getByRole("switch");
    expect(toggle.getAttribute("aria-checked")).toBe("true");

    fireEvent.click(toggle);

    expect(localSkillsAllowlist.value).toEqual([]);
    expect(skillsDirty.value).toBe(true);
  });
});

function skillFixture(overrides: { name: string; skillKey: string }) {
  return {
    always: false,
    baseDir: `/skills/${overrides.skillKey}`,
    blockedByAllowlist: false,
    configChecks: [],
    description: `${overrides.name} description`,
    disabled: false,
    eligible: true,
    filePath: `/skills/${overrides.skillKey}/SKILL.md`,
    install: [],
    missing: { anyBins: [], bins: [], config: [], env: [], os: [] },
    name: overrides.name,
    requirements: { anyBins: [], bins: [], config: [], env: [], os: [] },
    skillKey: overrides.skillKey,
    source: "core",
  };
}
