#!/usr/bin/env node

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const distDir = resolve(__dirname, "..", "dist");

// Get version from package.json
const packageJson = JSON.parse(
  await readFile(resolve(__dirname, "..", "package.json"), "utf-8")
);
const version = packageJson.version;

// Parse CLI arguments
const args = process.argv.slice(2);
let port = 8080;
let open = false;
let gatewayHost = process.env.GATEWAY_HOST || "127.0.0.1";
let gatewayPort = process.env.GATEWAY_PORT || "18789";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--port" || args[i] === "-p") {
    port = parseInt(args[i + 1], 10) || 8080;
    i++;
  } else if (args[i] === "--open" || args[i] === "-o") {
    open = true;
  } else if (args[i] === "--version" || args[i] === "-v") {
    console.log(`cove v${version}`);
    process.exit(0);
  } else if (args[i] === "--help" || args[i] === "-h") {
    console.log(`
Cove v${version} - WebUI for OpenClaw

Usage: npx @maudecode/cove [options]

Options:
  -p, --port <port>  Port to listen on (default: 8080)
  -o, --open         Open browser automatically
  -v, --version      Show version number
  -h, --help         Show this help message

Environment Variables:
  GATEWAY_HOST       Gateway hostname for canvas proxy (default: 127.0.0.1)
  GATEWAY_PORT       Gateway port for canvas proxy (default: 18789)

Examples:
  npx @maudecode/cove
  npx @maudecode/cove --port 3000
  npx @maudecode/cove --port 3000 --open
`);
    process.exit(0);
  }
}

// MIME types
const mimeTypes = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain",
};

/**
 * Check if a path is within the allowed directory (prevent path traversal)
 */
function isPathSafe(requestedPath, baseDir) {
  const fullPath = resolve(requestedPath);
  // Ensure resolved path starts with baseDir
  return fullPath === baseDir || fullPath.startsWith(baseDir + "/");
}

/**
 * Proxy /_canvas/* requests to gateway's canvas host
 */
async function handleCanvasProxy(req, res, urlPath) {
  if (!urlPath.startsWith("/_canvas")) return false;

  const targetPath = urlPath.replace("/_canvas", "") || "/";
  const targetUrl = `http://${gatewayHost}:${gatewayPort}/__openclaw__/canvas${targetPath}`;

  try {
    const response = await fetch(targetUrl, {
      headers: {
        Host: `${gatewayHost}:${gatewayPort}`,
        Accept: "*/*",
      },
    });

    const contentType = response.headers.get("Content-Type") || "application/octet-stream";
    const buffer = Buffer.from(await response.arrayBuffer());

    res.writeHead(response.status, {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(buffer);
  } catch (err) {
    console.error("Canvas proxy error:", err.message);
    res.writeHead(502);
    res.end(`Canvas proxy error: ${err.message}`);
  }
  return true;
}

// Serve static files
const server = createServer(async (req, res) => {
  try {
    let urlPath = req.url?.split("?")[0] || "/";
    if (urlPath === "/") urlPath = "/index.html";

    // Health check endpoint
    if (urlPath === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("OK");
      return;
    }

    // Canvas proxy
    if (await handleCanvasProxy(req, res, urlPath)) {
      return;
    }

    // Decode URL and resolve path
    const decodedPath = decodeURIComponent(urlPath);
    let filePath = resolve(distDir, "." + decodedPath);

    // Security: Ensure path doesn't escape dist directory
    if (!isPathSafe(filePath, distDir)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    // Check if file exists, otherwise serve index.html (SPA routing)
    try {
      const fileStat = await stat(filePath);
      if (fileStat.isDirectory()) {
        filePath = join(filePath, "index.html");
      }
    } catch {
      filePath = join(distDir, "index.html");
    }

    const ext = extname(filePath);
    const contentType = mimeTypes[ext] || "application/octet-stream";
    const content = await readFile(filePath);

    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  } catch (err) {
    res.writeHead(500);
    res.end("Internal Server Error");
  }
});

// Handle server errors
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n❌ Port ${port} is already in use.\n`);
    console.error(`   Try a different port: npx @maudecode/cove --port ${port + 1}\n`);
    process.exit(1);
  }
  console.error("Server error:", err);
  process.exit(1);
});

server.listen(port, () => {
  const url = `http://localhost:${port}`;
  console.log(`
🏖️  Cove v${version} is running!

   Local:  ${url}
   Proxy:  /_canvas/* → http://${gatewayHost}:${gatewayPort}/__openclaw__/canvas/*

   Connect to your OpenClaw gateway to get started.
   Press Ctrl+C to stop.
`);

  if (open) {
    const cmd =
      process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
          ? "start"
          : "xdg-open";
    exec(`${cmd} ${url}`);
  }
});
