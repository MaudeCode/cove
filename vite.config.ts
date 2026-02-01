import { defineConfig, type Plugin } from 'vite'
import preact from '@preact/preset-vite'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import { appendFileSync, writeFileSync, readFileSync } from 'fs'

// Read version from package.json
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))
const appVersion = pkg.version || '0.0.0'

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
export default defineConfig({
  plugins: [preact(), tailwindcss(), debugLogPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    allowedHosts: ['cove.maudeco.de'],
  },
})
