/**
 * Cove Production Server
 *
 * Serves static files from dist/ and proxies /canvas-proxy/* to the gateway.
 * Uses the same proxy logic as the Vite dev server.
 */

import { serve } from "bun";
import { readFileSync, existsSync, statSync } from "fs";
import { join, extname } from "path";
import {
  CANVAS_PROXY_PATH,
  handleCanvasProxy,
  getDefaultConfig,
} from "./server/canvas-proxy";

const PORT = parseInt(process.env.PORT || "8080", 10);
const DIST_DIR = join(import.meta.dir, "dist");
const proxyConfig = getDefaultConfig();

const MIME_TYPES: Record<string, string> = {
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
  ".webp": "image/webp",
};

serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // Health check
    if (pathname === "/health") {
      return new Response("OK", { status: 200 });
    }

    // Canvas proxy - use shared logic
    if (pathname.startsWith(CANVAS_PROXY_PATH + "/") || pathname === CANVAS_PROXY_PATH) {
      const requestPath = pathname.replace(CANVAS_PROXY_PATH, "") || "/";
      return handleCanvasProxy(requestPath, proxyConfig);
    }

    // Static file serving
    let filePath = join(DIST_DIR, pathname);

    // Check if path is a directory, serve index.html
    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
      filePath = join(filePath, "index.html");
    }

    // SPA fallback - serve index.html for non-existent paths
    if (!existsSync(filePath)) {
      filePath = join(DIST_DIR, "index.html");
    }

    if (existsSync(filePath)) {
      const ext = extname(filePath);
      const contentType = MIME_TYPES[ext] || "application/octet-stream";
      const content = readFileSync(filePath);

      // Cache static assets
      const cacheControl = ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable";

      return new Response(content, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": cacheControl,
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`🦞 Cove server running on http://0.0.0.0:${PORT}`);
console.log(
  `   Canvas proxy: ${CANVAS_PROXY_PATH}/* → http://${proxyConfig.gatewayHost}:${proxyConfig.gatewayPort}/__openclaw__/canvas/*`,
);
