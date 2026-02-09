# Configuration

Cove is primarily configured through its browser UI, but there are some important gateway settings that affect how Cove works.

## Cove Settings

All Cove settings are stored in your browser's localStorage. Open **Settings** (gear icon or `⌘,`) to access:

### Appearance
- **Theme** — Choose from 12+ themes (light, dark, Nord, Catppuccin, etc.)
- **Font Size** — Small, Medium, or Large
- **Font Family** — System, Geist, Inter, JetBrains Mono, or OpenDyslexic

### Preferences
- **Time Format** — Relative ("2 hours ago") or absolute (local time)

## Gateway Settings

These settings are configured in your OpenClaw gateway (`~/.openclaw/openclaw.json`):

### Canvas Host

Enable the canvas host so agents can push content to Cove:

```json
{
  "canvasHost": {
    "enabled": true
  }
}
```

### Network Binding

If Cove runs on a different machine (e.g., in Docker):

```json
{
  "bind": "lan"
}
```

This allows LAN connections to the gateway's canvas host.

### Webchat Settings

Control Cove-specific behaviors:

```json
{
  "webchat": {
    "capabilities": {
      "inlineButtons": "dm"
    }
  }
}
```

| Option | Values | Description |
|--------|--------|-------------|
| `inlineButtons` | `"dm"`, `"group"`, `"all"`, `"allowlist"` | Enable inline action buttons in chat |

## Environment Variables

When running the Cove server (via `npx @maudecode/cove` or Docker):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP server port |
| `GATEWAY_HOST` | `127.0.0.1` | Gateway hostname for canvas proxy |
| `GATEWAY_PORT` | `18789` | Gateway port for canvas proxy |

**Docker example:**
```bash
docker run -p 8080:8080 \
  -e GATEWAY_HOST=192.168.1.100 \
  -e GATEWAY_PORT=18789 \
  ghcr.io/maudecode/cove:latest
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘K` / `Ctrl+K` | Open command palette |
| `⌘Enter` / `Ctrl+Enter` | Send message |
| `Shift+Enter` | New line in message |
| `Escape` | Close modal/panel |
| `⌘Shift+C` / `Ctrl+Shift+C` | Toggle canvas panel |
| `⌘,` / `Ctrl+,` | Open settings |

## Resetting Cove

To reset all Cove settings and clear stored data:

1. Open Settings
2. Scroll to the bottom
3. Click **Reset to Defaults**

Or clear localStorage manually in your browser's developer tools.

## Next Steps

- [Deployment](/guide/deployment) — Production deployment options
- [Canvas Setup](/canvas/) — Enable canvas for agent content
