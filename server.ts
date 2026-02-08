/**
 * Cove Production Server
 * 
 * Serves static files from dist/ and proxies /canvas-proxy/* to the gateway.
 * This enables canvas to load local images without CORS/mixed-content issues.
 */

import { serve } from "bun";
import { readFileSync, existsSync, statSync } from "fs";
import { join, extname } from "path";

const PORT = parseInt(process.env.PORT || "8080", 10);
const DIST_DIR = join(import.meta.dir, "dist");
const GATEWAY_HOST = process.env.GATEWAY_HOST || "127.0.0.1";
const GATEWAY_PORT = process.env.GATEWAY_PORT || "18789";

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

    // Canvas proxy - forward to gateway
    if (pathname.startsWith("/canvas-proxy/") || pathname === "/canvas-proxy") {
      const targetPath = pathname.replace("/canvas-proxy", "") || "/";
      const targetUrl = `http://${GATEWAY_HOST}:${GATEWAY_PORT}/__openclaw__/canvas${targetPath}`;
      
      try {
        const response = await fetch(targetUrl);
        
        // Forward the response with proper headers
        return new Response(response.body, {
          status: response.status,
          headers: {
            "Content-Type": response.headers.get("Content-Type") || "application/octet-stream",
            "Cache-Control": "no-store",
          },
        });
      } catch (err) {
        console.error("Canvas proxy error:", err);
        return new Response(`Canvas proxy error: ${err}`, { status: 502 });
      }
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
console.log(`   Canvas proxy: /canvas-proxy/* → http://${GATEWAY_HOST}:${GATEWAY_PORT}/__openclaw__/canvas/*`);
