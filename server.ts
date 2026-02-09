/**
 * Cove Production Server
 *
 * Serves static files from dist/ and proxies /_canvas to gateway.
 * For development, use `vite` directly (see package.json "dev" script).
 *
 * Usage:
 *   NODE_ENV=production bun run server.ts
 *   bun run dev:prod  (after building)
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';

const PORT = parseInt(process.env.PORT || '8080', 10);
const DIST_DIR = join(import.meta.dir, 'dist');
const GATEWAY_HOST = process.env.GATEWAY_HOST || '127.0.0.1';
const GATEWAY_PORT = process.env.GATEWAY_PORT || '18789';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
};

/**
 * Canvas proxy handler - forwards /_canvas/* to gateway
 */
async function handleCanvasProxy(pathname: string): Promise<Response | null> {
  if (!pathname.startsWith('/_canvas')) return null;

  const targetPath = pathname.replace('/_canvas', '') || '/';
  const targetUrl = `http://${GATEWAY_HOST}:${GATEWAY_PORT}/__openclaw__/canvas${targetPath}`;

  try {
    const response = await fetch(targetUrl, {
      headers: {
        Host: `${GATEWAY_HOST}:${GATEWAY_PORT}`,
        Accept: '*/*',
      },
    });
    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('Canvas proxy error:', err);
    return new Response(`Canvas proxy error: ${err}`, { status: 502 });
  }
}

/**
 * Static file handler - serves from dist/
 */
function handleStaticFile(pathname: string): Response | null {
  let filePath = join(DIST_DIR, pathname);

  // Directory → try index.html
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, 'index.html');
  }

  // Not found → SPA fallback
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(DIST_DIR, 'index.html');
  }

  if (existsSync(filePath) && !statSync(filePath).isDirectory()) {
    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = readFileSync(filePath);
    const cacheControl = ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable';

    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': cacheControl,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  return null;
}

// Check dist/ exists
if (!existsSync(DIST_DIR)) {
  console.error('Error: dist/ not found. Run `bun run build` first.');
  process.exit(1);
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // Health check
    if (pathname === '/health') {
      return new Response('OK', { status: 200 });
    }

    // Canvas proxy
    const canvasResponse = await handleCanvasProxy(pathname);
    if (canvasResponse) return canvasResponse;

    // Static files
    const staticResponse = handleStaticFile(pathname);
    if (staticResponse) return staticResponse;

    return new Response('Not Found', { status: 404 });
  },
});

console.log(`🏖️  Cove Production Server`);
console.log('');
console.log(`   URL:    http://localhost:${PORT}`);
console.log(`   Proxy:  /_canvas/* → http://${GATEWAY_HOST}:${GATEWAY_PORT}/__openclaw__/canvas/*`);
console.log('');
