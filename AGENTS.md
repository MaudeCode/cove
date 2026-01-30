# AGENTS.md - Cove Development Guide

This file documents how Cove works for LLMs and developers working on the project.

## Project Overview

**Cove** is a WebUI for [OpenClaw](https://github.com/openclaw/openclaw) - an AI assistant gateway.

- **Stack**: Preact + Vite + TypeScript + Tailwind CSS
- **State**: Preact Signals (reactive, no Redux/Context complexity)
- **Styling**: Tailwind + CSS custom properties (themes)
- **Live URL**: https://cove.maudeco.de

## Architecture

```
src/
├── app.tsx              # Root component
├── main.tsx             # Entry point
├── lib/                 # Core libraries (non-React)
│   ├── gateway.ts       # WebSocket client for OpenClaw
│   ├── auth.ts          # Authentication state
│   ├── theme.ts         # Theme management
│   ├── i18n.ts          # Internationalization
│   └── themes/          # Theme color definitions
├── hooks/               # Preact hooks
├── components/          # UI components (coming)
├── views/               # Page-level components (coming)
├── signals/             # Global state signals
├── types/               # TypeScript types
├── locales/             # Translation files
└── styles/              # CSS
```

## Key Systems

### 1. Gateway WebSocket Client (`src/lib/gateway.ts`)

Connects to OpenClaw gateway using its WebSocket protocol.

**Protocol Flow:**
1. Client opens WebSocket to gateway URL
2. Server sends `connect.challenge` event with `{ nonce, ts }`
3. Client sends `connect` request with:
   ```ts
   {
     type: "req",
     id: "req_1",
     method: "connect",
     params: {
       minProtocol: 3,
       maxProtocol: 3,
       client: {
         id: "webchat-ui",      // Required: known client ID
         displayName: "Cove",
         version: "0.1.0",
         platform: "macos",     // or windows/linux/ios/android/web
         mode: "webchat"        // Required: webchat/cli/ui/backend/node
       },
       auth: {
         token: "...",          // OR password, not both
       }
     }
   }
   ```
4. Server responds with `hello-ok` payload containing features, snapshot, policy

**Usage:**
```ts
import { connect, send, on, isConnected } from '@/lib/gateway'

// Connect
await connect({ url: 'wss://gateway.example.com', token: '...' })

// Send RPC request
const result = await send('session.list', { limit: 10 })

// Subscribe to events
on('chat.message', (payload) => console.log(payload))

// Check connection (reactive signal)
if (isConnected.value) { ... }
```

**Valid Client IDs** (from OpenClaw protocol):
- `webchat-ui` - Web chat interface (use this for Cove)
- `openclaw-control-ui` - Control panel
- `cli` - Command line
- `openclaw-macos/ios/android` - Native apps

### 2. Theme System (`src/lib/theme.ts`)

Multi-theme support with system preference detection.

**Built-in Themes:** light, dark, nord, dracula, solarized-light, solarized-dark

**How it works:**
- Themes define CSS custom properties (e.g., `--color-bg-primary`)
- `theme-script.ts` inlines in `<head>` to prevent FOUC
- Theme preference stored in localStorage
- System mode (light/dark) auto-switches themes

**Usage:**
```ts
import { setTheme, activeTheme, themePreference } from '@/lib/theme'

setTheme('dark')           // Set specific theme
setTheme('system')         // Use system preference
activeTheme.value.name     // Current theme name
```

### 3. i18n System (`src/lib/i18n.ts`)

Translation and locale-aware formatting.

**Usage:**
```ts
import { t, formatDate, formatRelativeTime } from '@/lib/i18n'

t('actions.send')                    // "Send"
t('messages.count', { count: 5 })    // "5 messages" (pluralized)
formatRelativeTime(date)             // "2 hours ago"
formatBytes(1048576)                 // "1 MB"
```

**Adding translations:**
1. Add keys to `src/locales/en.json`
2. Use dot notation: `t('section.subsection.key')`
3. Plurals: add `_plural` suffix key

### 4. Auth State (`src/lib/auth.ts`)

Manages gateway credentials and auto-connect.

```ts
import { login, logout, autoConnect } from '@/lib/auth'

await login({ url, token, rememberMe: true })  // Saves to localStorage
await autoConnect()                             // Auto-login on app load
logout()                                        // Clear + disconnect
```

## Development

```bash
# Install
bun install

# Dev server (hot reload)
bun run dev

# Type check
bun run typecheck

# Lint + format
bun run lint
bun run format

# Build for production
bun run build
```

## Protocol Reference

The gateway protocol is defined in OpenClaw source:
- `src/gateway/protocol/schema/frames.ts` - Frame schemas
- `src/gateway/protocol/client-info.ts` - Valid client IDs/modes
- `src/gateway/server/ws-connection/message-handler.ts` - Server handling

Protocol version is currently **3**.

## Roadmap

- [x] Phase 0.1 - Project scaffold
- [x] Phase 0.2 - Theme system
- [x] Phase 0.3 - i18n infrastructure
- [x] Phase 0.4 - Gateway WebSocket client
- [ ] Phase 0.5 - Session & message signals
- [ ] Phase 1.x - Chat UI, message rendering, streaming
- [ ] Phase 2.x - Sessions sidebar, history
- [ ] Phase 3.x - Settings, config editing

## Notes for LLMs

1. **OpenClaw source** is at `~/git/openclaw/` - reference it for protocol details
2. **Signals over useState** - use `@preact/signals` for reactive state
3. **No default exports** - project uses named exports only (lint enforced)
4. **Console warnings OK** - `console.warn/error` for debugging is intentional
5. **CSS variables** - all colors use `var(--color-*)` for theming
