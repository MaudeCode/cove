import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";

const testWhenFixturesAreNotCoveredDirectly =
  process.env.COVE_DIRECT_FIXTURE_COVERAGE === "1" ? test.skip : test;

describe("Sidebar navigation and TopBar", () => {
  testWhenFixturesAreNotCoveredDirectly("passes the isolated layout fixture", () => {
    const result = spawnSync(
      process.execPath,
      ["test", "./tests/fixtures/layout/sidebar-nav-topbar-inner.fixture.tsx"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      },
    );

    expect(result.status, result.stdout + result.stderr).toBe(0);
  });
});
