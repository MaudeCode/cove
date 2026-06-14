/** @jsxImportSource preact */
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { signal } from "@preact/signals";
import type { ComponentChildren } from "preact";
import { fireEvent, renderComponent, screen, setViewport, waitFor } from "../../helpers/dom";
import { installI18nMock } from "../../helpers/i18n";
import { createGatewayTestHarness, createQueryParamMock } from "../../helpers/module-mocks";
import { installUiMocks } from "../../helpers/ui-mocks";
import type { SkillStatusEntry, SkillStatusReport } from "../../../src/types/skills";

const gatewayHarness = createGatewayTestHarness();
const sendCalls = gatewayHarness.calls;
const toastMessages: Array<[string, string]> = [];
const queryParamMock = createQueryParamMock({ initFromParam: true, syncUrl: true });
let importCounter = 0;

mock.module("@/lib/gateway", () => ({
  ...gatewayHarness.module(),
}));
installI18nMock();
mock.module("@/lib/session-utils", () => ({
  getErrorMessage: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));
mock.module("@/hooks/useQueryParam", () => queryParamMock);
mock.module(
  "@/hooks/useExpandableFromQueryParamSet",
  () => import("../../../src/hooks/useExpandableFromQueryParamSet"),
);
mock.module("@/components/skills", async () => {
  const skillRow = await import("../../../src/components/skills/SkillRow");
  const skillDetails = await import("../../../src/components/skills/SkillDetails");
  const installDepsModal = await import("../../../src/components/skills/InstallDepsModal");

  return {
    ...skillRow,
    ...skillDetails,
    ...installDepsModal,
    clawHubLoading: signal(false),
    ClawHubBrowser: () => <section>ClawHub browser</section>,
    refreshClawHub: () => undefined,
  };
});
installUiMocks({
  "@/components/ui/HintBox": () => ({
    HintBox: ({ children }: { children?: ComponentChildren }) => <div role="alert">{children}</div>,
  }),
  "@/components/ui/ListCard": () => ({
    ListCard: ({
      actions,
      badges,
      meta,
      onClick,
      subtitle,
      title,
    }: {
      actions?: ComponentChildren;
      badges?: ComponentChildren;
      meta?: Array<{ value: string }>;
      onClick?: () => void;
      subtitle?: string;
      title: string;
    }) => {
      const content = (
        <>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
          {badges}
          {meta?.map((item) => (
            <span key={item.value}>{item.value}</span>
          ))}
          {actions}
        </>
      );

      return onClick ? (
        <button onClick={onClick} type="button">
          {content}
        </button>
      ) : (
        <article>{content}</article>
      );
    },
  }),
  "@/components/ui/StatCard": () => ({
    StatCard: ({
      label,
      onClick,
      value,
    }: {
      label: string;
      onClick?: () => void;
      value: number | string;
    }) => (
      <button onClick={onClick} type="button">
        {label}:{value}
      </button>
    ),
  }),
  "@/components/ui/TabNav": () => ({
    TabNav: ({
      activeId,
      items,
      onChange,
    }: {
      activeId: string;
      items: Array<{ id: string; label: string }>;
      onChange: (id: string) => void;
    }) => (
      <div role="tablist">
        {items.map((item) => (
          <button
            aria-selected={item.id === activeId}
            key={item.id}
            onClick={() => onChange(item.id)}
            role="tab"
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
    ),
  }),
  "@/components/ui/Toast": () => ({
    toast: {
      error: (message: string) => toastMessages.push(["error", message]),
      success: (message: string) => toastMessages.push(["success", message]),
    },
  }),
});
mock.module("@/types/skills", () => import("../../../src/types/skills"));

beforeEach(() => {
  document.body.replaceChildren();
  setViewport(1024, 768);
  gatewayHarness.reset();
  toastMessages.length = 0;
  queryParamMock.reset();
  window.history.replaceState({}, "", "http://localhost/skills");
});

describe("SkillsView", () => {
  test("loads skills, filters by source/search, toggles enabled state, and installs dependencies", async () => {
    gatewayHarness.queueResponse("skills.status", skillsReport(), skillsReport());
    gatewayHarness.queueResponse("skills.update", {});
    gatewayHarness.queueResponse("skills.install", { ok: true });
    const { SkillsView } = await importSkillsView();

    renderComponent(<SkillsView />);

    await waitFor(() => expect(screen.getAllByText("Managed Skill").length).toBeGreaterThan(0));
    expect(sendCalls[0]).toEqual({ method: "skills.status", params: {} });
    expect(screen.getByText("common.total:3")).toBeTruthy();
    expect(screen.getByText("common.eligible:1")).toBeTruthy();
    expect(screen.getByText("common.disabled:1")).toBeTruthy();
    expect(screen.getByText("common.missingReqs:1")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("skills.filters.allSources"));
    fireEvent.click(screen.getByRole("option", { name: "common.workspace" }));
    expect(screen.getByText('skills.filteredCount:{"filtered":1,"total":3}')).toBeTruthy();

    fireEvent.input(screen.getByPlaceholderText("common.searchSkills"), {
      target: { value: "missing" },
    });
    expect(screen.getByText('skills.filteredCount:{"filtered":1,"total":3}')).toBeTruthy();

    const missingHeader = screen.getAllByText("Missing Skill")[1].closest("button");
    expect(missingHeader).toBeTruthy();
    fireEvent.click(missingHeader!);
    await waitFor(() => expect(screen.getByText("bins: pnpm")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "skills.installDeps" }));
    fireEvent.click(screen.getByText("Install pnpm").closest("button")!);

    await waitFor(() =>
      expect(sendCalls).toContainEqual({
        method: "skills.install",
        params: { installId: "pnpm", name: "Missing Skill", timeoutMs: 60000 },
      }),
    );
    expect(toastMessages).toContainEqual([
      "success",
      'skills.installSuccess:{"name":"Missing Skill"}',
    ]);

    fireEvent.click(screen.getAllByRole("switch", { name: "common.disable" })[1]);

    await waitFor(() =>
      expect(sendCalls).toContainEqual({
        method: "skills.update",
        params: { enabled: false, skillKey: "workspace/missing" },
      }),
    );
    expect(toastMessages).toContainEqual([
      "success",
      'skills.disabledSuccess:{"name":"Missing Skill"}',
    ]);
  });

  test("opens the mobile detail modal from the skill query param", async () => {
    setViewport(500, 800);
    window.history.replaceState({}, "", "http://localhost/skills?skill=workspace%2Fmissing");
    gatewayHarness.queueResponse("skills.status", skillsReport());
    const { SkillsView } = await importSkillsView();

    renderComponent(<SkillsView />);

    const dialog = await waitFor(() => screen.getByRole("dialog", { name: "Missing Skill" }));
    expect(dialog.textContent).toContain("skills.skillKey");
    expect(dialog.textContent).toContain("workspace/missing");
  });
});

async function importSkillsView(): Promise<typeof import("../../../src/views/SkillsView")> {
  // @ts-ignore Query suffix gives each test fresh view state.
  return import(`../../../src/views/SkillsView.tsx?unit=${importCounter++}`);
}

function skillsReport(): SkillStatusReport {
  return {
    managedSkillsDir: "/repo/.openclaw/skills",
    workspaceDir: "/repo",
    skills: [
      skill({
        description: "Ready managed skill",
        name: "Managed Skill",
        source: "openclaw-managed",
        skillKey: "managed/ready",
      }),
      skill({
        description: "Disabled bundled skill",
        disabled: true,
        name: "Bundled Skill",
        source: "openclaw-bundled",
        skillKey: "bundled/disabled",
      }),
      skill({
        description: "Needs pnpm",
        eligible: false,
        install: [{ bins: ["pnpm"], id: "pnpm", kind: "node", label: "Install pnpm" }],
        missing: { ...emptyRequirements(), bins: ["pnpm"] },
        name: "Missing Skill",
        source: "openclaw-workspace",
        skillKey: "workspace/missing",
      }),
    ],
  };
}

function skill(overrides: Partial<SkillStatusEntry> = {}): SkillStatusEntry {
  return {
    always: false,
    baseDir: "/repo/skills/skill",
    blockedByAllowlist: false,
    configChecks: [],
    description: "Skill description",
    disabled: false,
    eligible: true,
    filePath: "/repo/skills/skill/SKILL.md",
    install: [],
    missing: emptyRequirements(),
    name: "Skill",
    requirements: emptyRequirements(),
    skillKey: "skill",
    source: "openclaw-managed",
    ...overrides,
  };
}

function emptyRequirements() {
  return {
    anyBins: [],
    bins: [],
    config: [],
    env: [],
    os: [],
  };
}
