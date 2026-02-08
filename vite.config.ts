import { defineConfig, loadEnv, type Plugin } from 'vite'
import preact from '@preact/preset-vite'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import { appendFileSync, writeFileSync, readFileSync } from 'fs'

// Read version from package.json
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))
const appVersion = pkg.version || '0.0.0'

/**
 * CSP extension plugin - allows adding extra domains to CSP via environment variables.
 * Set VITE_CSP_EXTRA_DEFAULT_SRC and/or VITE_CSP_EXTRA_SCRIPT_SRC in .env.local
 * to inject vendor-specific domains (e.g., Cloudflare Access/Insights) at build time.
 * The repo stays clean; each deployment customizes their own build.
 */
function cspExtensionPlugin(env: Record<string, string>): Plugin {
  const extraDefaultSrc = env.VITE_CSP_EXTRA_DEFAULT_SRC || ''
  const extraScriptSrc = env.VITE_CSP_EXTRA_SCRIPT_SRC || ''

  return {
    name: 'cove-csp-extension',
    transformIndexHtml(html) {
      if (!extraDefaultSrc && !extraScriptSrc) {
        return html
      }

      let modified = html

      if (extraDefaultSrc) {
        modified = modified.replace(
          /default-src\s+'self'/,
          `default-src 'self' ${extraDefaultSrc}`
        )
      }

      if (extraScriptSrc) {
        modified = modified.replace(
          /script-src\s+'self'\s+'unsafe-inline'/,
          `script-src 'self' 'unsafe-inline' ${extraScriptSrc}`
        )
      }

      return modified
    }
  }
}

/**
 * Canvas proxy plugin - proxies requests to the local gateway's canvas host.
 * This bypasses mixed content restrictions (HTTPS Cove → HTTP gateway).
 * Usage: /canvas-proxy/path/to/file → http://127.0.0.1:${gatewayPort}/__openclaw__/canvas/path/to/file
 */
function canvasProxyPlugin(env: Record<string, string>): Plugin {
  const gatewayPort = env.VITE_GATEWAY_PORT || '18789'
  const gatewayHost = env.VITE_GATEWAY_HOST || '127.0.0.1'
  
  return {
    name: 'cove-canvas-proxy',
    configureServer(server) {
      server.middlewares.use('/canvas-proxy', async (req, res) => {
        const targetPath = req.url || '/'
        const targetUrl = `http://${gatewayHost}:${gatewayPort}/__openclaw__/canvas${targetPath}`
        
        try {
          const response = await fetch(targetUrl)
          
          if (!response.ok) {
            res.writeHead(response.status)
            res.end(await response.text())
            return
          }
          
          // Forward content-type header
          const contentType = response.headers.get('content-type')
          if (contentType) {
            res.setHeader('Content-Type', contentType)
          }
          
          // Stream the response body
          const buffer = await response.arrayBuffer()
          res.writeHead(200)
          res.end(Buffer.from(buffer))
        } catch (err) {
          res.writeHead(502)
          res.end(`Canvas proxy error: ${err}`)
        }
      })
    }
  }
}

/**
 * Debug logging plugin - accepts POSTs to /__cove_debug and writes to debug.log
 * This lets the AI read client-side logs without needing browser access.
 */
function debugLogPlugin(): Plugin {
  const logFile = resolve(__dirname, 'debug.log')
  
  // Clear log on server start
  writeFileSync(logFile, `=== Cove Debug Log Started ${new Date().toISOString()} ===\n`)
  
  return {
    name: 'cove-debug-log',
    configureServer(server) {
      server.middlewares.use('/__cove_debug', (req, res) => {
        if (req.method === 'POST') {
          let body = ''
          req.on('data', chunk => { body += chunk })
          req.on('end', () => {
            try {
              const { level, namespace, message, data } = JSON.parse(body)
              const timestamp = new Date().toISOString()
              const dataStr = data ? ` ${JSON.stringify(data)}` : ''
              const line = `[${timestamp}] [${level.toUpperCase()}] [${namespace}] ${message}${dataStr}\n`
              appendFileSync(logFile, line)
              res.writeHead(200)
              res.end('ok')
            } catch {
              res.writeHead(400)
              res.end('bad request')
            }
          })
        } else if (req.method === 'DELETE') {
          // Clear log
          writeFileSync(logFile, `=== Log cleared ${new Date().toISOString()} ===\n`)
          res.writeHead(200)
          res.end('cleared')
        } else {
          res.writeHead(405)
          res.end('method not allowed')
        }
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [preact(), tailwindcss(), cspExtensionPlugin(env), canvasProxyPlugin(env), debugLogPlugin()],
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    server: {
      allowedHosts: env.VITE_ALLOWED_HOSTS?.split(',').map(h => h.trim()).filter(Boolean) || [],
    },
  }
})
