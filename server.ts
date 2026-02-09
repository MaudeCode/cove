/**
 * Cove Server
 *
 * Single entry point for both dev and production:
 * - Dev: Vite middleware mode for HMR
 * - Prod: Static file serving
 * - Both: Same /_canvas proxy to gateway
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';
import type { ViteDevServer } from 'vite';

const DEV = process.env.NODE_ENV !== 'production';
const PORT = parseInt(process.env.PORT || (DEV ? '5173' : '8080'), 10);
const DIST_DIR = join(import.meta.dir, 'dist');
// Default to localhost for co-located setups
// Set GATEWAY_HOST to point to a remote gateway if needed
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
 * Strips headers that cause gateway to reject requests
 */
async function handleCanvasProxy(pathname: string): Promise<Response | null> {
  if (!pathname.startsWith('/_canvas')) return null;

  const targetPath = pathname.replace('/_canvas', '') || '/';
  const targetUrl = `http://${GATEWAY_HOST}:${GATEWAY_PORT}/__openclaw__/canvas${targetPath}`;

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'Host': `${GATEWAY_HOST}:${GATEWAY_PORT}`,
        'Accept': '*/*',
      },
    });
    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('Canvas proxy error:', err);
    return new Response(`Canvas proxy error: ${err}`, { status: 502 });
  }
}

/**
 * Static file handler for production
 */
function handleStaticFile(pathname: string): Response | null {
  let filePath = join(DIST_DIR, pathname);

  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, 'index.html');
  }

  if (!existsSync(filePath)) {
    filePath = join(DIST_DIR, 'index.html');
  }

  if (existsSync(filePath)) {
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

async function startServer() {
  let vite: ViteDevServer | null = null;

  if (DEV) {
    // Dynamic import - Vite is only installed in dev
    const { createServer: createViteServer } = await import('vite');
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
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

      // Canvas proxy - same in dev and prod
      const canvasResponse = await handleCanvasProxy(pathname);
      if (canvasResponse) return canvasResponse;

      if (DEV && vite) {
        // Dev mode: use Vite middleware
        return new Promise<Response>((resolve) => {
          // Convert Bun request to Node-compatible format for Vite
          const nodeReq = {
            url: pathname + url.search,
            method: req.method,
            headers: Object.fromEntries(req.headers.entries()),
          };

          const nodeRes = {
            statusCode: 200,
            headers: {} as Record<string, string>,
            body: [] as Buffer[],
            setHeader(name: string, value: string) {
              this.headers[name.toLowerCase()] = value;
            },
            getHeader(name: string) {
              return this.headers[name.toLowerCase()];
            },
            writeHead(status: number, headers?: Record<string, string>) {
              this.statusCode = status;
              if (headers) Object.assign(this.headers, headers);
            },
            write(chunk: Buffer | string) {
              this.body.push(Buffer.from(chunk));
              return true;
            },
            end(chunk?: Buffer | string) {
              if (chunk) this.body.push(Buffer.from(chunk));
              resolve(
                new Response(Buffer.concat(this.body), {
                  status: this.statusCode,
                  headers: this.headers,
                })
              );
            },
          };

          vite!.middlewares(nodeReq as any, nodeRes as any, () => {
            // Fallback: serve index.html for SPA routing
            try {
              const html = readFileSync(join(import.meta.dir, 'index.html'), 'utf-8');
              vite!.transformIndexHtml(pathname, html).then((transformed) => {
                resolve(
                  new Response(transformed, {
                    status: 200,
                    headers: { 'Content-Type': 'text/html' },
                  })
                );
              }).catch((err) => {
                console.error('Vite transform error:', err);
                resolve(new Response('Internal Server Error', { status: 500 }));
              });
            } catch (err) {
              console.error('Failed to read index.html:', err);
              resolve(new Response('Internal Server Error', { status: 500 }));
            }
          });
        });
      } else {
        // Production: serve static files
        const staticResponse = handleStaticFile(pathname);
        if (staticResponse) return staticResponse;
        return new Response('Not Found', { status: 404 });
      }
    },
  });

  console.log(`🏖️  Cove v${process.env.npm_package_version || 'dev'} is running!`);
  console.log('');
  console.log(`   Local:  http://localhost:${PORT}`);
  console.log('');
  console.log(`   Mode: ${DEV ? 'development' : 'production'}`);
  console.log(`   Canvas proxy: /_canvas/* → http://${GATEWAY_HOST}:${GATEWAY_PORT}/__openclaw__/canvas/*`);
  console.log('');
  console.log('   Connect to your OpenClaw gateway to get started.');
  if (DEV) {
    console.log('   HMR enabled via Vite middleware.');
  }
  console.log('');
}

startServer().catch(console.error);
