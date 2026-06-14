import { createServer, type Server } from "node:http";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";

const repoRoot = resolve(import.meta.dir, "..", "..");
const coveBin = join(repoRoot, "bin", "cove.js");

interface SpawnCoveServerOptions {
  distDir: string;
  env?: NodeJS.ProcessEnv;
}

interface SpawnedCoveServer {
  baseUrl: string;
  stderr: () => string;
  stdout: () => string;
  stop: () => Promise<void>;
}

export async function createTestDist(): Promise<{ dir: string; remove: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), "cove-cli-dist-"));
  await mkdir(join(dir, "assets"), { recursive: true });
  await writeFile(
    join(dir, "index.html"),
    '<!doctype html><html><head><title>Cove Test</title></head><body><div id="app">Cove Shell</div></body></html>',
  );
  await writeFile(join(dir, "assets", "app.js"), 'console.log("cove smoke");');
  await writeFile(join(dir, "assets", "style.css"), "body { color: black; }");
  await writeFile(join(dir, "manifest.json"), '{"name":"Cove Test"}');
  await writeFile(join(dir, "favicon.svg"), '<svg xmlns="http://www.w3.org/2000/svg"></svg>');

  return {
    dir,
    remove: () => rm(dir, { recursive: true, force: true }),
  };
}

export async function spawnCoveServer({
  distDir,
  env,
}: SpawnCoveServerOptions): Promise<SpawnedCoveServer> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await spawnCoveServerOnce({ distDir, env });
    } catch (error) {
      lastError = error;
      if (!String(error).includes("already in use")) {
        throw error;
      }
    }
  }

  throw lastError;
}

async function spawnCoveServerOnce({
  distDir,
  env,
}: SpawnCoveServerOptions): Promise<SpawnedCoveServer> {
  const port = await getFreePort();
  const child = spawn("node", [coveBin, "--port", String(port)], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...env,
      COVE_DIST_DIR: distDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForHealth(child, baseUrl, () => stderr);

  return {
    baseUrl,
    stderr: () => stderr,
    stdout: () => stdout,
    stop: () => stopChild(child),
  };
}

export async function createCanvasGateway(
  handler: (path: string) => { body: string; contentType: string; status?: number },
): Promise<{ close: () => Promise<void>; host: string; port: number }> {
  const server = createServer((req, res) => {
    const result = handler(req.url ?? "/");
    res.writeHead(result.status ?? 200, { "Content-Type": result.contentType });
    res.end(result.body);
  });

  const port = await listenOnFreePort(server);

  return {
    close: () => closeServer(server),
    host: "127.0.0.1",
    port,
  };
}

async function getFreePort(): Promise<number> {
  const server = createServer();
  const port = await listenOnFreePort(server);
  await closeServer(server);
  return port;
}

async function listenOnFreePort(server: Server): Promise<number> {
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to allocate a local port.");
  }
  return address.port;
}

async function waitForHealth(
  child: CoveChildProcess,
  baseUrl: string,
  readStderr: () => string,
): Promise<void> {
  const startedAt = Date.now();
  let exitCode: number | null = null;
  child.once("exit", (code) => {
    exitCode = code;
  });

  while (Date.now() - startedAt < 5_000) {
    if (exitCode !== null) {
      throw new Error(`Cove server exited before health check passed: ${readStderr()}`);
    }

    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok && (await response.text()) === "OK") {
        return;
      }
    } catch {
      // Server is still starting.
    }
    await new Promise((resolvePoll) => setTimeout(resolvePoll, 25));
  }

  await stopChild(child);
  throw new Error(`Timed out waiting for Cove server health check: ${readStderr()}`);
}

async function stopChild(child: CoveChildProcess): Promise<void> {
  if (child.exitCode !== null || child.killed) return;

  await new Promise<void>((resolveStop) => {
    let forceTimeout: ReturnType<typeof setTimeout> | null = null;
    const gracefulTimeout = setTimeout(() => {
      child.kill("SIGKILL");
      forceTimeout = setTimeout(resolveStop, 1_000);
    }, 1_000);

    child.once("exit", () => {
      clearTimeout(gracefulTimeout);
      if (forceTimeout) clearTimeout(forceTimeout);
      resolveStop();
    });
    child.kill("SIGTERM");
  });
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolveClose, rejectClose) => {
    server.close((error) => (error ? rejectClose(error) : resolveClose()));
  });
}

type CoveChildProcess = ChildProcessByStdio<null, Readable, Readable>;
