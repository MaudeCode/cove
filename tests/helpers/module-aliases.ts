import { mock } from "bun:test";

const installedAliases = new Set<string>();

function mockAliasOnce(specifier: string, factory: () => unknown): void {
  if (installedAliases.has(specifier)) return;
  installedAliases.add(specifier);
  mock.module(specifier, factory);
}

export async function installUiComponentAliases(): Promise<void> {
  mockAliasOnce("@/components/ui/Input", () => import("../../src/components/ui/Input"));
  mockAliasOnce("@/components/ui/Toggle", () => import("../../src/components/ui/Toggle"));
  mockAliasOnce("@/components/ui/Dropdown", () => import("../../src/components/ui/Dropdown"));
  mockAliasOnce("@/components/ui/Textarea", () => import("../../src/components/ui/Textarea"));
  mockAliasOnce("@/components/ui/Button", () => import("../../src/components/ui/Button"));
  mockAliasOnce("@/components/ui/IconButton", () => import("../../src/components/ui/IconButton"));
  mockAliasOnce("@/components/ui/Card", () => import("../../src/components/ui/Card"));
  mockAliasOnce("@/components/ui/Spinner", () => import("../../src/components/ui/Spinner"));
  mockAliasOnce("@/components/ui/icons", () => import("../../src/components/ui/icons"));
  mockAliasOnce("@/components/ui/CoveLogo", () => import("../../src/components/ui/CoveLogo"));
}

export async function installConfigComponentAliases(): Promise<void> {
  mockAliasOnce("@/hooks/useClickOutside", () => ({
    useClickOutside: () => undefined,
  }));

  mockAliasOnce("@/lib/config/schema-utils", () => import("../../src/lib/config/schema-utils"));
  mockAliasOnce("@/lib/config/nav-tree", () => import("../../src/lib/config/nav-tree"));
  await installUiComponentAliases();
}
