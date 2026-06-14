import { describe, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const runDockerSmoke = process.env.COVE_RUN_DOCKER_SMOKE === "1";
const dockerTest = runDockerSmoke ? test : test.skip;

describe("Docker nginx runtime smoke", () => {
  dockerTest("serves the built app through nginx with deployment headers", async () => {
    const tag = `cove-deployment-smoke:${process.pid}-${Date.now()}`;
    let containerId: string | null = null;
    const gateway = await createCanvasGateway();

    try {
      await docker(["build", "-t", tag, "."]);
      const run = await docker([
        "run",
        "-d",
        "--rm",
        "-p",
        "127.0.0.1::8080",
        "--add-host",
        "host.docker.internal:host-gateway",
        "-e",
        "GATEWAY_HOST=host.docker.internal",
        "-e",
        `GATEWAY_PORT=${gateway.port}`,
        tag,
      ]);
      containerId = run.stdout.trim();

      const baseUrl = await waitForContainerUrl(containerId);
      const health = await fetch(`${baseUrl}/health`);
      expect(health.status).toBe(200);
      expect(health.headers.get("content-type")).toContain("text/plain");
      expect(await health.text()).toBe("OK");

      const index = await fetch(`${baseUrl}/`);
      const indexHtml = await index.text();
      expect(index.status).toBe(200);
      expect(index.headers.get("content-type")).toContain("text/html");
      expect(index.headers.get("x-frame-options")).toBe("SAMEORIGIN");
      expect(index.headers.get("x-content-type-options")).toBe("nosniff");
      expect(index.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
      expect(index.headers.get("permissions-policy")).toBe(
        "camera=(), microphone=(), geolocation=()",
      );
      expect(indexHtml).toContain('<div id="app"></div>');

      const appRoute = await fetch(`${baseUrl}/settings/appearance`);
      expect(appRoute.status).toBe(200);
      expect(appRoute.headers.get("content-type")).toContain("text/html");
      expect(await appRoute.text()).toContain('<div id="app"></div>');

      const blocked = await fetch(`${baseUrl}/probe.php`);
      expect(blocked.status).toBe(404);

      const assetPath = indexHtml.match(/\b(?:src|href)="([^"]*\/assets\/[^"]+\.(?:js|css))"/)?.[1];
      if (!assetPath) {
        throw new Error("Failed to find a built JS or CSS asset in index.html.");
      }
      const asset = await fetch(`${baseUrl}${assetPath}`);
      expect(asset.status).toBe(200);
      expect(asset.headers.get("cache-control")).toBe("public, immutable");
      expect(asset.headers.get("x-content-type-options")).toBe("nosniff");
      expect(asset.headers.get("expires")).toBeTruthy();

      const canvas = await fetch(`${baseUrl}/_canvas/frame.html?token=1`, {
        headers: {
          "CF-Connecting-IP": "203.0.113.1",
          "CF-IPCountry": "US",
          "CF-Ray": "ray-test",
          "CF-Visitor": "https",
          Forwarded: "for=203.0.113.1",
          "X-Forwarded-For": "203.0.113.1",
          "X-Forwarded-Host": "cove.example.test",
          "X-Forwarded-Proto": "https",
          "X-Real-IP": "203.0.113.1",
        },
      });
      expect(canvas.status).toBe(200);
      expect(canvas.headers.get("content-type")).toContain("text/html");
      expect(canvas.headers.get("cache-control")).toBe("no-store");
      expect(canvas.headers.get("access-control-allow-origin")).toBe("*");
      expect(await canvas.text()).toBe("<canvas>proxied</canvas>");

      expect(gateway.requests).toHaveLength(1);
      expect(gateway.requests[0]?.url).toBe("/__openclaw__/canvas/frame.html?token=1");
      expect(gateway.requests[0]?.headers.host).toBe("localhost");
      for (const header of [
        "cf-connecting-ip",
        "cf-ipcountry",
        "cf-ray",
        "cf-visitor",
        "forwarded",
        "x-forwarded-for",
        "x-forwarded-host",
        "x-forwarded-proto",
        "x-real-ip",
      ]) {
        expect(gateway.requests[0]?.headers[header] ?? "").toBe("");
      }
    } finally {
      if (containerId) {
        await docker(["rm", "-f", containerId]).catch(() => undefined);
      }
      await docker(["image", "rm", "-f", tag]).catch(() => undefined);
      await gateway.close();
    }
  });
});

interface CapturedRequest {
  headers: IncomingHttpHeaders;
  url: string;
}

async function createCanvasGateway(): Promise<{
  close: () => Promise<void>;
  port: number;
  requests: CapturedRequest[];
}> {
  const requests: CapturedRequest[] = [];
  const server = createServer((req, res) => {
    requests.push({ headers: req.headers, url: req.url ?? "/" });
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<canvas>proxied</canvas>");
  });

  const port = await new Promise<number>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "0.0.0.0", () => {
      server.off("error", rejectListen);
      const address = server.address();
      if (!address || typeof address === "string") {
        rejectListen(new Error("Failed to allocate mock gateway port."));
        return;
      }
      resolveListen(address.port);
    });
  });

  return {
    close: () => closeServer(server),
    port,
    requests,
  };
}

async function waitForContainerUrl(containerId: string): Promise<string> {
  const startedAt = Date.now();
  let baseUrl = "";

  while (Date.now() - startedAt < 30_000) {
    if (!baseUrl) {
      const port = await docker(["port", containerId, "8080/tcp"]);
      const endpoint = port.stdout.trim().split("\n")[0];
      if (endpoint) {
        baseUrl = `http://${endpoint.replace("0.0.0.0", "127.0.0.1")}`;
      }
    }

    if (baseUrl) {
      try {
        const response = await fetch(`${baseUrl}/health`);
        if (response.ok && (await response.text()) === "OK") {
          return baseUrl;
        }
      } catch {
        // nginx is still starting.
      }
    }

    await new Promise((resolvePoll) => setTimeout(resolvePoll, 250));
  }

  const logs = await docker(["logs", containerId]).catch((error) => ({
    stdout: "",
    stderr: String(error),
  }));
  throw new Error(
    `Timed out waiting for Docker nginx smoke container:\n${logs.stdout}${logs.stderr}`,
  );
}

async function docker(args: string[]) {
  return execFileAsync("docker", args, {
    cwd: new URL("../../..", import.meta.url),
    maxBuffer: 10 * 1024 * 1024,
  });
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolveClose, rejectClose) => {
    server.close((error) => (error ? rejectClose(error) : resolveClose()));
  });
}
