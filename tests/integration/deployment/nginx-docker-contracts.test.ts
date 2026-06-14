import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "..", "..", "..");

const dockerfile = await readText("Dockerfile");
const dockerCompose = await readText("docker-compose.yml");
const activeDockerCompose = dockerCompose
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("#"))
  .join("\n");
const nginxConf = await readText("nginx.conf");
const nginxTemplate = await readText("nginx.conf.template");

describe("Docker and nginx deployment contracts", () => {
  test("Dockerfile builds Cove assets and serves the nginx template on port 8080", () => {
    expect(dockerfile).toContain("FROM oven/bun:1-alpine AS builder");
    expect(dockerfile).toContain("RUN bun install --frozen-lockfile");
    expect(dockerfile).toContain("RUN bun run build");
    expect(dockerfile).toContain("FROM nginxinc/nginx-unprivileged:alpine");
    expect(dockerfile).toContain("COPY --from=builder /app/dist /usr/share/nginx/html");
    expect(dockerfile).toContain(
      "COPY nginx.conf.template /etc/nginx/templates/default.conf.template",
    );
    expect(dockerfile).toContain("ENV GATEWAY_HOST=127.0.0.1");
    expect(dockerfile).toContain("ENV GATEWAY_PORT=18789");
    expect(dockerfile).toContain("EXPOSE 8080");
    expect(dockerfile).toContain("http://localhost:8080/health");
  });

  test("docker compose keeps the unprivileged nginx runtime hardened", () => {
    expect(activeDockerCompose).toContain("build: .");
    expect(activeDockerCompose).toContain('"8080:8080"');
    expect(activeDockerCompose).toContain("read_only: true");
    expect(activeDockerCompose).toContain("no-new-privileges:true");
    expect(activeDockerCompose).toContain("cap_drop:");
    expect(activeDockerCompose).toContain("- ALL");
    expect(activeDockerCompose).toContain("/tmp:noexec,nosuid,size=10m");
    expect(activeDockerCompose).toContain("/var/cache/nginx:noexec,nosuid,size=50m");
    expect(activeDockerCompose).toContain("/var/run:noexec,nosuid,size=10m");
    expect(activeDockerCompose).toContain("http://localhost:8080/health");
    expect(activeDockerCompose).toContain("interval: 30s");
    expect(activeDockerCompose).toContain("timeout: 3s");
    expect(activeDockerCompose).toContain("retries: 3");
    expect(activeDockerCompose).toContain("start_period: 5s");
  });

  test("nginx configs expose health and SPA fallback routes", () => {
    for (const config of deploymentConfigs()) {
      expect(locationBlock(config.content, "/health")).toContain('return 200 "OK";');
      expect(locationBlock(config.content, "/health")).toContain(
        "add_header Content-Type text/plain;",
      );
      expect(locationBlock(config.content, "/health")).toContain("access_log off;");

      expect(locationBlock(config.content, "/")).toContain("try_files $uri $uri/ /index.html;");
      expect(config.content).toContain("root /usr/share/nginx/html;");
      expect(config.content).toContain("listen 8080;");
    }
  });

  test("nginx configs set security and static asset cache headers", () => {
    for (const config of deploymentConfigs()) {
      expect(config.content).toContain('add_header X-Frame-Options "SAMEORIGIN" always;');
      expect(config.content).toContain('add_header X-Content-Type-Options "nosniff" always;');
      expect(config.content).toContain('add_header X-XSS-Protection "1; mode=block" always;');
      expect(config.content).toContain(
        'add_header Referrer-Policy "strict-origin-when-cross-origin" always;',
      );
      expect(config.content).toContain(
        'add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;',
      );
      expect(config.content).toContain("server_tokens off;");

      const staticBlock = locationBlock(config.content, "~* \\.(js|css");
      expect(staticBlock).toContain("expires 1y;");
      expect(staticBlock).toContain('add_header Cache-Control "public, immutable";');
      assertSecurityHeaders(staticBlock);
      for (const extension of [
        "js",
        "css",
        "png",
        "jpg",
        "jpeg",
        "gif",
        "ico",
        "svg",
        "woff",
        "woff2",
      ]) {
        expect(staticBlock).toContain(extension);
      }

      assertSecurityHeaders(locationBlock(config.content, "/health"));
    }
  });

  test("canvas proxy strips forwarded identity headers and disables caching", () => {
    expect(canvasProxyBlock(nginxConf)).toContain(
      "proxy_pass http://127.0.0.1:18789/__openclaw__/canvas/;",
    );
    expect(canvasProxyBlock(nginxTemplate)).toContain(
      "proxy_pass http://${GATEWAY_HOST}:${GATEWAY_PORT}/__openclaw__/canvas/;",
    );

    for (const config of deploymentConfigs()) {
      const block = canvasProxyBlock(config.content);
      expect(block).toContain("proxy_http_version 1.1;");
      expect(block).toContain("proxy_set_header Host localhost;");
      for (const header of [
        "X-Forwarded-For",
        "X-Forwarded-Proto",
        "X-Forwarded-Host",
        "Forwarded",
        "X-Real-IP",
        "CF-Connecting-IP",
        "CF-IPCountry",
        "CF-Ray",
        "CF-Visitor",
      ]) {
        expect(block).toContain(`proxy_set_header ${header} "";`);
      }
      expect(block).toContain("proxy_cache off;");
      expect(block).toContain('add_header Cache-Control "no-store" always;');
      expect(block).toContain('add_header Access-Control-Allow-Origin "*" always;');
      assertSecurityHeaders(block);
    }
  });
});

function deploymentConfigs(): Array<{ content: string; name: string }> {
  return [
    { name: "nginx.conf", content: nginxConf },
    { name: "nginx.conf.template", content: nginxTemplate },
  ];
}

async function readText(path: string): Promise<string> {
  return readFile(join(repoRoot, path), "utf8");
}

function canvasProxyBlock(config: string): string {
  return locationBlock(config, "^~ /_canvas/");
}

function assertSecurityHeaders(block: string): void {
  expect(block).toContain('add_header X-Frame-Options "SAMEORIGIN" always;');
  expect(block).toContain('add_header X-Content-Type-Options "nosniff" always;');
  expect(block).toContain('add_header X-XSS-Protection "1; mode=block" always;');
  expect(block).toContain('add_header Referrer-Policy "strict-origin-when-cross-origin" always;');
  expect(block).toContain(
    'add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;',
  );
}

function locationBlock(config: string, location: string): string {
  const start = config.indexOf(`location ${location}`);
  if (start === -1) {
    throw new Error(`Missing nginx location block: ${location}`);
  }
  return readBraceBlock(config, start);
}

function readBraceBlock(config: string, start: number): string {
  const open = config.indexOf("{", start);
  if (open === -1) {
    throw new Error("Missing nginx block opening brace.");
  }

  let depth = 0;
  for (let index = open; index < config.length; index++) {
    if (config[index] === "{") depth++;
    if (config[index] === "}") depth--;
    if (depth === 0) {
      return config.slice(start, index + 1);
    }
  }

  throw new Error("Missing nginx block closing brace.");
}
