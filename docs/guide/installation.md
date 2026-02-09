# Installation

There are several ways to run Cove depending on your needs.

## Quick Start (npx)

The easiest way — no installation required:

```bash
npx @maudecode/cove
```

Options:
```bash
npx @maudecode/cove --port 3000      # Custom port
npx @maudecode/cove --open           # Open browser automatically
```

## Global Install (npm)

Install globally for repeated use:

```bash
npm install -g @maudecode/cove
cove
```

## Docker

Run Cove in a container:

```bash
docker run -p 8080:8080 ghcr.io/maudecode/cove:latest
```

With custom gateway:

```bash
docker run -p 8080:8080 \
  -e GATEWAY_HOST=your-gateway.local \
  -e GATEWAY_PORT=18789 \
  ghcr.io/maudecode/cove:latest
```

## From Source

For development or customization:

```bash
git clone https://github.com/MaudeCode/cove.git
cd cove
bun install
bun run dev
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GATEWAY_HOST` | `127.0.0.1` | Gateway hostname for canvas proxy |
| `GATEWAY_PORT` | `18789` | Gateway port for canvas proxy |

## Next Steps

- [Deployment](/guide/deployment) — Production deployment options
- [Canvas Setup](/canvas/) — Enable canvas for agent content
