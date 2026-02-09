## 🖼️ Canvas Panel

Let your agent push images, diagrams, and rich content directly to your browser with the new canvas feature:

- **Floating panel** — Drag anywhere, dock to edges, or pop out to a separate window
- **Local images without base64** — The `/_canvas/` proxy serves images from your gateway's canvas directory
- **All commands supported** — `present`, `hide`, `navigate`, `eval`, and `snapshot`
- **Multi-tab sync** — Canvas state syncs across browser tabs automatically
- **Works everywhere** — Dev server, npm package, and Docker all include the canvas proxy

Enable it in Settings → Canvas Node, then agents can push content with:
```
nodes action=invoke node=<id> invokeCommand=canvas.present invokeParamsJson='{"url":"/_canvas/image.png"}'
```

---

## 📚 Documentation Site

New VitePress-powered documentation at [maudecode.github.io/cove](https://maudecode.github.io/cove):

- **Getting started guides** — Installation, configuration, deployment
- **Canvas setup** — Step-by-step instructions for gateway and Cove
- **Agent reference** — Complete skill doc for using canvas from agents
- **Auto-deployed** — Updates on every push to `docs/`

---

## 🐳 Improved Docker Container

The Docker image now uses nginx with a proper canvas proxy:

- **Smaller and faster** — nginx serves static files efficiently
- **Canvas proxy built-in** — Configure with `GATEWAY_HOST` and `GATEWAY_PORT` env vars
- **Rootless and secure** — Runs as non-root with read-only filesystem
