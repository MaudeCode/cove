import { describe, expect, test } from "bun:test";
import { readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { cspExtensionPlugin } from "../../../vite.config";

const repoRoot = resolve(import.meta.dir, "..", "..", "..");
const packageJson = JSON.parse(await readText("package.json")) as {
  bin: Record<string, string>;
  files: string[];
  name: string;
  publishConfig?: { access?: string };
  version: string;
};
const indexHtml = await readText("index.html");
const docsConfig = await readText("docs/.vitepress/config.ts");
const docsWorkflow = await readText(".github/workflows/docs.yml");
const releaseWorkflow = await readText(".github/workflows/release.yml");
const manifest = JSON.parse(await readText("public/manifest.json")) as {
  icons?: Array<{ src?: string }>;
  name?: string;
  short_name?: string;
  start_url?: string;
};

describe("release and documentation build contracts", () => {
  test("docs workflow rebuilds docs for relevant changes with frozen installs", () => {
    expect(docsWorkflow).toContain("pull_request:");
    expect(docsWorkflow).toContain("paths:");
    for (const path of [
      "'docs/**'",
      "'package.json'",
      "'bun.lock'",
      "'.github/workflows/docs.yml'",
    ]) {
      expect(docsWorkflow).toContain(path);
    }

    expect(docsWorkflow).toContain("run: bun install --frozen-lockfile");
    expect(docsWorkflow).toContain("bun-version: 1.3.14");
    expect(docsWorkflow).toContain("docs-pr-{0}");
    expect(docsWorkflow).toContain("github.event_name == 'pull_request'");
    expect(docsWorkflow).toContain("run: bun run docs:build");
    expect(docsWorkflow).toContain(
      "if: github.event_name == 'push' || github.event_name == 'workflow_dispatch'",
    );
    expect(docsWorkflow).toContain("path: docs/.vitepress/dist");
    expect(docsConfig).toContain("base: '/cove/'");
    expect(docsConfig).toContain("href: '/cove/favicon-32.png'");
  });

  test("release workflow gates npm packaging with package integrity tests", () => {
    expect(releaseWorkflow).toContain("bun install --frozen-lockfile");
    expect(releaseWorkflow).toContain("bun run build");
    expect(releaseWorkflow).toContain("bun run test:package");
    expect(releaseWorkflow).toContain("npm pack");
  });

  test("package metadata ships the built app and executable CLI", async () => {
    expect(packageJson.name).toBe("@maudecode/cove");
    expect(packageJson.publishConfig?.access).toBe("public");
    expect(packageJson.files).toEqual(["dist", "bin"]);
    expect(packageJson.bin["@maudecode/cove"]).toBe("./bin/cove.js");

    const bin = await readText("bin/cove.js");
    expect(bin.startsWith("#!/usr/bin/env node")).toBe(true);
    expect(bin).toContain('resolve(process.env.COVE_DIST_DIR || resolve(__dirname, "..", "dist"))');
    expect(bin).toContain('await readFile(resolve(__dirname, "..", "package.json"), "utf-8")');
  });

  test("app manifest and referenced install assets exist", async () => {
    expect(indexHtml).toContain('<link rel="manifest" href="/manifest.json" />');
    expect(manifest.name).toBe("Cove");
    expect(manifest.short_name).toBe("Cove");
    expect(manifest.start_url).toBe("/");

    const iconPaths = manifest.icons?.map((icon) => icon.src).filter(isString) ?? [];
    expect(iconPaths).toContain("/apple-touch-icon.png");
    expect(iconPaths).toContain("/cove-icon.png");
    expect(indexHtml).toContain('href="/favicon-16x16.png"');
    expect(indexHtml).toContain('href="/favicon-32x32.png"');

    for (const iconPath of iconPaths) {
      await expectFile(`public/${iconPath.replace(/^\//, "")}`);
    }
    await expectFile("public/favicon-16x16.png");
    await expectFile("public/favicon-32x32.png");
  });

  test("CSP extension plugin appends configured default-src and script-src values", () => {
    const transformed = transformCsp(indexHtml, {
      VITE_CSP_EXTRA_DEFAULT_SRC: "https://team.example.test",
      VITE_CSP_EXTRA_SCRIPT_SRC: "https://scripts.example.test",
    });

    expect(transformed).toContain("default-src 'self' https://team.example.test;");
    expect(transformed).toContain(
      "script-src 'self' 'unsafe-inline' https://scripts.example.test;",
    );
    expect(transformed).toContain("connect-src 'self' ws://* wss://* https:;");
  });

  test("CSP extension plugin can append default-src without changing script-src", () => {
    const transformed = transformCsp(indexHtml, {
      VITE_CSP_EXTRA_DEFAULT_SRC: "https://default-only.example.test",
    });

    expect(transformed).toContain("default-src 'self' https://default-only.example.test;");
    expect(transformed).toContain("script-src 'self' 'unsafe-inline';");
  });

  test("CSP extension plugin can append script-src without changing default-src", () => {
    const transformed = transformCsp(indexHtml, {
      VITE_CSP_EXTRA_SCRIPT_SRC: "https://script-only.example.test",
    });

    expect(transformed).toContain("default-src 'self';");
    expect(transformed).toContain(
      "script-src 'self' 'unsafe-inline' https://script-only.example.test;",
    );
  });

  test("CSP extension plugin leaves index.html unchanged without extension env", () => {
    expect(transformCsp(indexHtml, {})).toBe(indexHtml);
  });

  test("CSP extension plugin fails loudly when configured directives are missing", () => {
    expect(() =>
      transformCsp("script-src 'self' 'unsafe-inline';", {
        VITE_CSP_EXTRA_DEFAULT_SRC: "https://default.example.test",
      }),
    ).toThrow("default-src directive was not found");
    expect(() =>
      transformCsp("default-src 'self';", {
        VITE_CSP_EXTRA_SCRIPT_SRC: "https://script.example.test",
      }),
    ).toThrow("script-src directive was not found");
  });
});

async function readText(path: string): Promise<string> {
  return readFile(join(repoRoot, path), "utf8");
}

async function expectFile(path: string): Promise<void> {
  expect((await stat(join(repoRoot, path))).isFile()).toBe(true);
}

function transformCsp(html: string, env: Record<string, string>): string {
  const transform = cspExtensionPlugin(env).transformIndexHtml;
  if (typeof transform !== "function") {
    throw new Error("Expected CSP plugin to expose a function transformIndexHtml hook.");
  }
  return transform.call({} as ThisParameterType<typeof transform>, html, {
    path: "/index.html",
    filename: "index.html",
  }) as string;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}
