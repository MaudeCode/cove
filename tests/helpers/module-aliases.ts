import { mock } from "bun:test";
import { computed, signal } from "@preact/signals";

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
  await mockAliasIfMissing("@/components/ui/Input", () => import("../../src/components/ui/Input"));
  await mockAliasIfMissing(
    "@/components/ui/Toggle",
    () => import("../../src/components/ui/Toggle"),
  );
  await mockAliasIfMissing(
    "@/components/ui/Dropdown",
    () => import("../../src/components/ui/Dropdown"),
  );
  await mockAliasIfMissing(
    "@/components/ui/Textarea",
    () => import("../../src/components/ui/Textarea"),
  );
  await mockAliasIfMissing(
    "@/components/ui/Button",
    () => import("../../src/components/ui/Button"),
  );
  await mockAliasIfMissing(
    "@/components/ui/IconButton",
    () => import("../../src/components/ui/IconButton"),
  );
  await mockAliasIfMissing("@/components/ui/Card", () => import("../../src/components/ui/Card"));
  await mockAliasIfMissing(
    "@/components/ui/Spinner",
    () => import("../../src/components/ui/Spinner"),
  );
  await mockAliasIfMissing("@/components/ui/icons", () => import("../../src/components/ui/icons"));
  await mockAliasIfMissing(
    "@/components/ui/CoveLogo",
    () => import("../../src/components/ui/CoveLogo"),
  );
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
  await mockAliasIfMissing("@/signals/sessions", () => createChatSessionsAlias());
}

function createChatSessionsAlias() {
  const sessions = signal<Array<{ key: string; updatedAtMs?: number }>>([]);
  const activeSessionKey = signal<string | null>(null);
  const sessionKindFilter = signal<string | null>(null);
  const sessionSearchQuery = signal("");
  const showCronSessions = signal(false);
  const deletingSessionKey = signal<string | null>(null);
  const effectiveSessionKey = computed(() => activeSessionKey.value);
  const activeSession = computed(
    () => sessions.value.find((session) => session.key === activeSessionKey.value) ?? null,
  );

  return {
    activeSession,
    activeSessionKey,
    cleanupSessionEventSubscription: () => undefined,
    clearSessions: () => {
      sessions.value = [];
      activeSessionKey.value = null;
    },
    deletingSessionKey,
    effectiveSessionKey,
    initSessionEventSubscription: () => undefined,
    isForActiveSession: (sessionKey: string | null | undefined) =>
      !sessionKey || !activeSessionKey.value || sessionKey === activeSessionKey.value,
    loadSessions: async () => undefined,
    removeSessionAnimated: async (sessionKey: string) => {
      sessions.value = sessions.value.filter((session) => session.key !== sessionKey);
    },
    sessionKindFilter,
    sessions,
    sessionsByRecent: computed(() => [...sessions.value]),
    sessionsGrouped: computed(() => ({})),
    sessionSearchQuery,
    setActiveSession: (sessionKey: string | null) => {
      activeSessionKey.value = sessionKey;
    },
    setSessionKindFilter: (kind: string | null) => {
      sessionKindFilter.value = kind;
    },
    setSessionSearchQuery: (query: string) => {
      sessionSearchQuery.value = query;
    },
    showCronSessions,
    toggleCronSessions: () => {
      showCronSessions.value = !showCronSessions.value;
    },
    updateSession: (sessionKey: string, updates: Record<string, unknown>) => {
      sessions.value = sessions.value.map((session) =>
        session.key === sessionKey ? { ...session, ...updates } : session,
      );
    },
  };
}

export async function installConfigComponentAliases(): Promise<void> {
  mockAliasOnce("@/hooks/useClickOutside", () => ({
    useClickOutside: () => undefined,
  }));

  mockAliasOnce("@/lib/config/schema-utils", () => import("../../src/lib/config/schema-utils"));
  mockAliasOnce("@/lib/config/nav-tree", () => import("../../src/lib/config/nav-tree"));
  await installUiComponentAliases();
}
