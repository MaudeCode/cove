import { afterEach, describe, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createConnection } from "node:net";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { createCanvasGateway, createTestDist, spawnCoveServer } from "../../helpers/cli-server";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(import.meta.dir, "..", "..", "..");
const coveBin = join(repoRoot, "bin", "cove.js");
const packageJson = JSON.parse(
  await readFile(join(repoRoot, "package.json"), "utf8"),
) as typeof import("../../../package.json");

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  const pending = cleanups.splice(0).reverse();
  for (const cleanup of pending) {
    await cleanup();
  }
});

describe("cove CLI server", () => {
  test("prints help and version without starting the server", async () => {
    const version = await execFileAsync("node", [coveBin, "--version"], { cwd: repoRoot });
    expect(version.stdout.trim()).toBe(`cove v${packageJson.version}`);
    expect(version.stderr).toBe("");

    const help = await execFileAsync("node", [coveBin, "--help"], { cwd: repoRoot });
    expect(help.stdout).toContain(`Cove v${packageJson.version} - WebUI for OpenClaw`);
    expect(help.stdout).toContain("--port <port>");
    expect(help.stdout).toContain("GATEWAY_HOST");
    expect(help.stderr).toBe("");
  });

  test("serves health, static files, MIME types, and SPA fallbacks", async () => {
    const dist = await createTestDist();
    cleanups.push(dist.remove);

    const server = await spawnCoveServer({ distDir: dist.dir });
    cleanups.push(server.stop);

    const health = await fetch(`${server.baseUrl}/health`);
    expect(health.status).toBe(200);
    expect(health.headers.get("content-type")).toBe("text/plain");
    expect(await health.text()).toBe("OK");

    const index = await fetch(`${server.baseUrl}/`);
    expect(index.status).toBe(200);
    expect(index.headers.get("content-type")).toBe("text/html");
    expect(await index.text()).toContain("Cove Shell");

    const spaFallback = await fetch(`${server.baseUrl}/settings/appearance`);
    expect(spaFallback.status).toBe(200);
    expect(spaFallback.headers.get("content-type")).toBe("text/html");
    expect(await spaFallback.text()).toContain("Cove Shell");

    const js = await fetch(`${server.baseUrl}/assets/app.js`);
    expect(js.status).toBe(200);
    expect(js.headers.get("content-type")).toBe("application/javascript");
    expect(await js.text()).toContain("cove smoke");

    const css = await fetch(`${server.baseUrl}/assets/style.css`);
    expect(css.status).toBe(200);
    expect(css.headers.get("content-type")).toBe("text/css");
    expect(await css.text()).toContain("color: black");

    const manifest = await fetch(`${server.baseUrl}/manifest.json`);
    expect(manifest.status).toBe(200);
    expect(manifest.headers.get("content-type")).toBe("application/json");
    expect(await manifest.json()).toEqual({ name: "Cove Test" });

    expect(server.stdout()).toContain(`Local:  http://localhost`);
    expect(server.stderr()).toBe("");
  });

  test("rejects path traversal before SPA fallback", async () => {
    const dist = await createTestDist();
    cleanups.push(dist.remove);

    const server = await spawnCoveServer({ distDir: dist.dir });
    cleanups.push(server.stop);

    const response = await rawRequest(server.baseUrl, "/%2e%2e/package.json");
    expect(response.status).toBe(403);
    expect(response.body).toContain("Forbidden");
  });

  test("proxies _canvas requests to the configured gateway canvas host", async () => {
    const dist = await createTestDist();
    cleanups.push(dist.remove);

    const seenPaths: string[] = [];
    const gateway = await createCanvasGateway((path) => {
      seenPaths.push(path);
      return {
        body: "<canvas>proxied</canvas>",
        contentType: "text/html; charset=utf-8",
      };
    });
    cleanups.push(gateway.close);

    const server = await spawnCoveServer({
      distDir: dist.dir,
      env: {
        GATEWAY_HOST: gateway.host,
        GATEWAY_PORT: String(gateway.port),
      },
    });
    cleanups.push(server.stop);

    const response = await fetch(`${server.baseUrl}/_canvas/frame.html`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(await response.text()).toBe("<canvas>proxied</canvas>");
    expect(seenPaths).toEqual(["/__openclaw__/canvas/frame.html"]);
  });
});

async function rawRequest(
  baseUrl: string,
  path: string,
): Promise<{ body: string; status: number }> {
  const url = new URL(baseUrl);

  return new Promise((resolveRequest, rejectRequest) => {
    const socket = createConnection(Number(url.port), url.hostname);
    let response = "";

    socket.setEncoding("utf8");
    socket.on("connect", () => {
      socket.write(`GET ${path} HTTP/1.1\r\nHost: ${url.host}\r\nConnection: close\r\n\r\n`);
    });
    socket.on("data", (chunk) => {
      response += chunk;
    });
    socket.on("error", rejectRequest);
    socket.on("end", () => {
      const [head = "", body = ""] = response.split("\r\n\r\n");
      const status = Number(head.match(/^HTTP\/1\.1 (\d+)/)?.[1] ?? 0);
      resolveRequest({ body, status });
    });
  });
}
