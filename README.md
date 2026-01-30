# 🏖️ Cove

A cozy WebUI for [OpenClaw](https://github.com/openclaw/openclaw) chat.

Built with [Preact](https://preactjs.com/) + [Vite](https://vitejs.dev/) + [Tailwind CSS](https://tailwindcss.com/).

## Philosophy

**Keep it minimal.** Resist the urge to add dependencies. Preact is chosen specifically because it's tiny (~3KB). Every addition should be justified.

## Features

- 🔌 Full OpenClaw gateway WebSocket protocol support
- 🎨 6 built-in themes (light, dark, nord, dracula, solarized variants)
- 🌙 System preference auto-switching
- 🌍 i18n ready with formatting utilities
- ⚡ Zero FOUC (Flash of Unstyled Content)
- 📱 Responsive design

## Development

```bash
# Install dependencies
bun install

# Start dev server
bun run dev

# Type check
bun run typecheck

# Lint + format
bun run lint
bun run format

# Build for production
bun run build
```

## Architecture

See [AGENTS.md](./AGENTS.md) for detailed documentation on how the codebase works.

## Progress

- [x] Phase 0.1 - Project scaffold
- [x] Phase 0.2 - Theme system (6 themes, FOUC-free)
- [x] Phase 0.3 - i18n infrastructure
- [x] Phase 0.4 - Gateway WebSocket client
- [ ] Phase 0.5 - Session & message signals
- [ ] Phase 1.x - Chat UI, message rendering, streaming

## License

MIT
