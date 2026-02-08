# Cove Canvas Skill

This document teaches agents how to use the Cove canvas feature to display content to users.

## Overview

When a user connects via Cove (OpenClaw's WebUI), a canvas panel is available for displaying rich content like images, HTML, and web pages. The canvas appears as a floating/dockable panel in the browser.

## Finding the Connected Node

Cove registers as a node with canvas capability. First, find connected nodes:

```bash
openclaw nodes list
```

Look for a node with `canvas` in its capabilities. The node ID will be a hash like `d88a00a972fee7589d45ad350eb28ced543ffe5256b82850c38cb02ed18a2acc`.

**Using the nodes tool:**
```
nodes action=status
```

This returns connected nodes with their IDs, display names, and capabilities.

## How to Use

### Method 1: nodes invoke tool (Recommended)

Use the `nodes` tool with `action=invoke`:

```
nodes action=invoke node=<nodeId> invokeCommand=canvas.present invokeParamsJson='{"url":"https://example.com"}'
```

### Method 2: CLI

```bash
openclaw nodes invoke --node <nodeId> --command canvas.present --params '<JSON>'
```

### ⚠️ Do NOT use the canvas tool

The `canvas` tool has a schema bug — the `target` parameter is defined as an enum but the implementation expects a URL string. Use `nodes invoke` instead until this is fixed.

## Commands

### canvas.present

Show content in the canvas panel. Opens the panel if closed.

**Display a URL:**
```
nodes action=invoke node=<nodeId> invokeCommand=canvas.present invokeParamsJson='{"url":"https://example.com"}'
```

**Display an image (base64):**
```bash
IMAGE_BASE64=$(base64 -i /path/to/image.png | tr -d '\n')
openclaw nodes invoke --node <nodeId> --command canvas.present \
  --params "{\"imageBase64\":\"${IMAGE_BASE64}\",\"imageMimeType\":\"image/png\"}"
```

**Display HTML content (base64):**
```bash
HTML_BASE64=$(echo '<html><body><h1>Hello!</h1></body></html>' | base64 | tr -d '\n')
openclaw nodes invoke --node <nodeId> --command canvas.present \
  --params "{\"imageBase64\":\"${HTML_BASE64}\",\"imageMimeType\":\"text/html\"}"
```

### canvas.hide

Hide the canvas panel:
```
nodes action=invoke node=<nodeId> invokeCommand=canvas.hide invokeParamsJson='{}'
```

### canvas.navigate

Update the canvas content (same parameters as `canvas.present`):
```
nodes action=invoke node=<nodeId> invokeCommand=canvas.navigate invokeParamsJson='{"url":"https://example.com"}'
```

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | string | URL to display in an iframe |
| `imageBase64` | string | Base64-encoded content (image or HTML) |
| `imageMimeType` | string | MIME type (e.g., `image/png`, `text/html`) |

## Local Images Without Base64

To avoid base64 encoding large images:

1. **Serve images via HTTP** — Copy to a directory served by a local web server
2. **Use the URL** — Push the HTTP URL to the canvas

Example using MaudeUtils (if configured):
```
# Copy image to served directory
cp /path/to/image.png ~/agents/maude/maudeutils/public/canvas/

# Push URL to canvas
nodes action=invoke node=<nodeId> invokeCommand=canvas.present invokeParamsJson='{"url":"https://utils.maudeco.de/canvas/image.png"}'
```

## Limitations

- **CORS**: Many sites block iframe embedding via CSP. Wikipedia works; most major sites don't.
- **Local files**: `file://` URLs don't work in iframes due to browser security.
- **Canvas host auth**: The gateway's canvas host (port 18793) requires auth that iframes can't pass.

## When to Use

- **Showing generated images** — Charts, diagrams, AI-generated images
- **Rich previews** — HTML mockups, styled content
- **Visual references** — Screenshots, diagrams from the web
- **Interactive content** — HTML with forms, animations

## Troubleshooting

### Node not found
- Check if Cove has "Canvas Node" enabled in settings
- Refresh Cove and check console for `[node] Node connected` message
- Run `nodes action=status` to see connected nodes

### Content not appearing
- Check browser console for errors
- Verify URL is accessible (not blocked by CORS)
- Try a known-working URL like `https://example.com`

### Panel doesn't auto-open
- Press `Cmd+Shift+C` to manually toggle the panel
- Check if `standaloneCanvasOpen` is stuck (another tab has `/canvas` open)
