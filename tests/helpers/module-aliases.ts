import { mock } from "bun:test";

const installedAliases = new Set<string>();

function mockAliasOnce(specifier: string, factory: () => unknown): void {
  if (installedAliases.has(specifier)) return;
  installedAliases.add(specifier);
  mock.module(specifier, factory);
}

async function mockAliasIfMissing(specifier: string, factory: () => unknown): Promise<void> {
  if (installedAliases.has(specifier)) return;
  try {
    await import(specifier);
    installedAliases.add(specifier);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      !message.includes("Cannot find package") &&
      !message.includes("Cannot find module") &&
      !message.includes("Module not found")
    ) {
      throw error;
    }
    mockAliasOnce(specifier, factory);
  }
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

export async function installChatSignalAliases(): Promise<void> {
  (globalThis as { __APP_VERSION__?: string }).__APP_VERSION__ ??= "test";
  await mockAliasIfMissing("@/lib/constants", () => import("../../src/lib/constants"));
  await mockAliasIfMissing(
    "@/lib/debounced-signal",
    () => import("../../src/lib/debounced-signal"),
  );
  await mockAliasIfMissing(
    "@/lib/message-detection",
    () => import("../../src/lib/message-detection"),
  );
  await mockAliasIfMissing("@/lib/storage", () => import("../../src/lib/storage"));
  await mockAliasIfMissing("@/signals/sessions", () => ({
    isForActiveSession: () => true,
  }));
}

export async function installConfigComponentAliases(): Promise<void> {
  mockAliasOnce("@/hooks/useClickOutside", () => ({
    useClickOutside: () => undefined,
  }));

  mockAliasOnce("@/lib/config/schema-utils", () => import("../../src/lib/config/schema-utils"));
  mockAliasOnce("@/lib/config/nav-tree", () => import("../../src/lib/config/nav-tree"));
  await installUiComponentAliases();
}
