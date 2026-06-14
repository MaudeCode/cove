import { describe, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const runPackageIntegrity = process.env.COVE_RUN_PACKAGE_INTEGRITY === "1";
const packageTest = runPackageIntegrity ? test : test.skip;

describe("npm package integrity", () => {
  packageTest(
    "packs the built CLI and app assets without source-only files",
    async () => {
      await execFileAsync("bun", ["run", "build"], {
        cwd: repoRoot(),
        maxBuffer: 20 * 1024 * 1024,
      });

      const { stdout } = await execFileAsync(
        "npm",
        ["pack", "--dry-run", "--json", "--ignore-scripts"],
        {
          cwd: repoRoot(),
          maxBuffer: 20 * 1024 * 1024,
        },
      );
      const [pack] = JSON.parse(stdout) as Array<{
        files: Array<{ path: string }>;
      }>;
      const paths = pack.files.map((file) => file.path).sort();

      for (const required of [
        "package.json",
        "bin/cove.js",
        "dist/index.html",
        "dist/manifest.json",
        "dist/favicon.svg",
        "dist/favicon-16x16.png",
        "dist/favicon-32x32.png",
        "dist/apple-touch-icon.png",
        "dist/cove-icon.png",
      ]) {
        expect(paths).toContain(required);
      }

      expect(paths.some((path) => path.startsWith("dist/assets/") && path.endsWith(".js"))).toBe(
        true,
      );
      expect(paths.some((path) => path.startsWith("dist/assets/") && path.endsWith(".css"))).toBe(
        true,
      );

      for (const excludedPrefix of ["src/", "tests/", "docs/", ".github/"]) {
        expect(paths.some((path) => path.startsWith(excludedPrefix))).toBe(false);
      }
    },
    60_000,
  );
});

function repoRoot(): URL {
  return new URL("../../..", import.meta.url);
}
