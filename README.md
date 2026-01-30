# 🏖️ Cove

A cozy WebUI for [OpenClaw](https://github.com/openclaw/openclaw).

Built with [Preact](https://preactjs.com/) + [Vite](https://vitejs.dev/) + [Tailwind CSS](https://tailwindcss.com/).

## Philosophy

**Keep it minimal.** Resist the urge to add dependencies. Preact is chosen specifically because it's tiny (~3KB). Every addition should be justified.

## Features

- 🔌 Full OpenClaw gateway WebSocket protocol support
- 💬 Real-time chat with streaming responses
- 🛠️ Tool call visualization with expandable details
- 🎨 6 built-in themes (light, dark, nord, dracula, solarized variants)
- 🌙 System preference auto-switching
- 🌍 i18n ready with formatting utilities
- ⚡ Zero FOUC (Flash of Unstyled Content)
- 📱 Responsive design (mobile drawer, tablet collapsible, desktop always-visible)
- 🧩 Component-based architecture with reusable UI primitives

## Screenshots

*Coming soon*

## Quick Start

```bash
# Install dependencies
bun install

# Start dev server (accessible via tunnel at cove.maudeco.de)
bun run dev -- --host 0.0.0.0

# Build for production
bun run build
```

## Architecture

```
src/
├── components/
│   ├── ui/           # Reusable primitives (Button, Input, Card, Modal, etc.)
│   ├── chat/         # Chat-specific (MessageList, ChatInput, ToolCall, etc.)
│   └── layout/       # App structure (AppShell, TopBar, Sidebar)
├── views/            # Page components (ChatView, LoginView, CronView, etc.)
├── lib/
│   ├── gateway.ts    # WebSocket client with auto-reconnect
│   ├── navigation.tsx # Centralized navigation config
│   ├── theme.ts      # Theme management
│   ├── i18n.ts       # Internationalization
│   └── ...
├── signals/          # Preact Signals for state (auth, sessions, ui)
├── types/            # TypeScript type definitions
└── locales/          # i18n translation files
```

### Navigation System

All pages are defined in `src/lib/navigation.tsx`:

```tsx
// Add a new page:
{
  id: "mypage",           // View identifier
  labelKey: "nav.mypage", // i18n key
  icon: MyPageIcon,       // Icon component
  requiresConnection: true, // Hide when disconnected
  external: "https://...", // Optional: external link
}
```

The sidebar automatically renders from this config with collapsible sections.

### UI Components

Located in `src/components/ui/`:

| Component | Description |
|-----------|-------------|
| `Button` | Primary, secondary, ghost, danger variants |
| `IconButton` | Icon-only accessible button |
| `Input` | Text input with error state |
| `Select` | Dropdown with options |
| `Toggle` | iOS-style switch |
| `Checkbox` | Traditional checkbox |
| `Card` | Surface container with title/subtitle |
| `FormField` | Label + input + error wrapper |
| `Modal` | Dialog with focus trap |
| `Toast` | Notification system |
| `Badge` | Status indicators |
| `Spinner` | Loading state |
| `Skeleton` | Loading placeholder |

## Pages

### Implemented
- ✅ **Chat** — Real-time conversation with streaming, markdown, tool calls
- ✅ **Login** — Gateway auth (token/password), remember me

### Placeholders (UI ready, awaiting implementation)
- 📋 **Overview** — Gateway health, quick stats
- 📋 **Channels** — Messaging channel status/config
- 📋 **Instances** — Connected clients
- 📋 **Sessions** — Session management
- 📋 **Cron Jobs** — Scheduled task management
- 📋 **Skills** — Available skills browser
- 📋 **Nodes** — Paired device management
- 📋 **Config** — Configuration editor
- 📋 **Debug** — Raw snapshots, RPC tester
- 📋 **Logs** — Gateway log viewer

## Development

```bash
bun run dev          # Start dev server
bun run build        # Production build
bun run typecheck    # TypeScript check
bun run lint         # oxlint
bun run format       # oxfmt
bun run check        # All checks
```

## Tech Stack

| Choice | Reason |
|--------|--------|
| Preact + Signals | Tiny (~3KB), fine-grained reactivity |
| Tailwind CSS v4 | Utility-first, CSS variables for theming |
| Vite | Fast builds, great DX |
| TypeScript | Type safety |
| markdown-it + Prism | Markdown rendering with syntax highlighting |
| oxlint + oxfmt | Fast Rust-based linting/formatting |

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for detailed progress.

**Current Phase:** 1 (Core Features) ✅ → Phase 2 (Session & History) next

## License

MIT
