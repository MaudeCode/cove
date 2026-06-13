import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const checkedFiles = ["src/app.tsx", "src/signals/settings.ts"];
const staticallyLoadedStartupModules = ["@/signals/settings", "@/lib/node-connection"] as const;

describe("build import boundaries", () => {
  test("does not dynamically import modules already loaded in the startup graph", () => {
    const offenders = checkedFiles.flatMap((file) => {
      const source = readFileSync(file, "utf8");

      return staticallyLoadedStartupModules
        .filter((specifier) => source.includes(`import("${specifier}")`))
        .map((specifier) => `${file} imports ${specifier}`);
    });

    expect(offenders).toEqual([]);
  });

  test("configures vendor chunks for build output", () => {
    const source = readFileSync("vite.config.ts", "utf8");

    expect(source).toContain("manualChunks");
    expect(source).toContain("app-core");
    expect(source).toContain("app-ui");
    expect(source).toContain("vendor-icons");
    expect(source).toContain("vendor-preact");
  });
});
