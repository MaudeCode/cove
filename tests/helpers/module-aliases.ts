import { mock } from "bun:test";

export async function installConfigComponentAliases(): Promise<void> {
  mock.module("@/hooks/useClickOutside", () => ({
    useClickOutside: () => undefined,
  }));

  mock.module("@/lib/config/schema-utils", () => import("../../src/lib/config/schema-utils"));
  mock.module("@/lib/config/nav-tree", () => import("../../src/lib/config/nav-tree"));
  mock.module("@/components/ui/Input", () => import("../../src/components/ui/Input"));
  mock.module("@/components/ui/Toggle", () => import("../../src/components/ui/Toggle"));
  mock.module("@/components/ui/Dropdown", () => import("../../src/components/ui/Dropdown"));
  mock.module("@/components/ui/Textarea", () => import("../../src/components/ui/Textarea"));
  mock.module("@/components/ui/Button", () => import("../../src/components/ui/Button"));
  mock.module("@/components/ui/IconButton", () => import("../../src/components/ui/IconButton"));
  mock.module("@/components/ui/Card", () => import("../../src/components/ui/Card"));
}
