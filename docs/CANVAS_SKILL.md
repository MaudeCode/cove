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

### canvas.eval

Execute JavaScript in the canvas iframe and return the result:
```
nodes action=invoke node=<nodeId> invokeCommand=canvas.eval invokeParamsJson='{"javaScript":"document.title"}'
```

**Returns:** `{ ok: true, result: "Page Title" }` or `{ ok: false, error: "..." }`

**Limitations:**
- Only works on same-origin content (URLs loaded through the `/_canvas/` proxy)
- Cross-origin iframes (external URLs, data: URLs) will fail due to browser security
- For cross-origin content, use `canvas.snapshot` instead

### canvas.snapshot

Capture a screenshot of the current canvas content:
```
nodes action=invoke node=<nodeId> invokeCommand=canvas.snapshot invokeParamsJson='{}'
```

**Optional parameters:**
```
nodes action=invoke node=<nodeId> invokeCommand=canvas.snapshot invokeParamsJson='{"maxWidth":1200,"quality":0.9,"outputFormat":"png"}'
```

**Returns:** `{ ok: true, dataUrl: "data:image/jpeg;base64,..." }` or `{ ok: false, error: "..." }`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `maxWidth` | number | 800 | Maximum width in pixels (scales proportionally) |
| `quality` | number | 0.8 | JPEG quality (0.0-1.0, ignored for PNG) |
| `outputFormat` | string | `jpeg` | Output format: `jpeg`, `jpg`, or `png` |

**Notes:**
- Works on both same-origin and cross-origin content (uses canvas capture)
- Larger images produce larger base64 strings — keep `maxWidth` reasonable
- JPEG at 0.8 quality is a good balance of size vs. quality

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | string | URL to display in an iframe |
| `imageBase64` | string | Base64-encoded content (image or HTML) |
| `imageMimeType` | string | MIME type (e.g., `image/png`, `text/html`) |

## Pushing HTML via Data URL (No Base64)

You can push HTML directly using a `data:` URL. The HTML must be URL-encoded:

```bash
# URL-encode the HTML
HTML='<html><body style="background:#1a1a1a;color:white"><h1>Hello!</h1></body></html>'
ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$HTML'))")

# Push to canvas
openclaw nodes invoke --node <nodeId> --command canvas.present \
  --params "{\"url\":\"data:text/html;charset=utf-8,$ENCODED\"}"
```

**Using the nodes tool:**
```
nodes action=invoke node=<nodeId> invokeCommand=canvas.present invokeParamsJson='{"url":"data:text/html;charset=utf-8,%3Chtml%3E..."}'
```

**Important:** The HTML must be URL-encoded. Unencoded special characters (quotes, brackets, etc.) will break the data URL.

## Local Images Without Base64

Cove includes a server proxy that routes `/_canvas/*` to the gateway's canvas host.
This bypasses mixed content, CORS, and CSP issues.

**How it works:**
1. Copy image to `~/.openclaw/canvas/`
2. Push URL using the `/_canvas/` path
3. Cove's server proxies to the local gateway

**Example:**
```bash
# Copy image to gateway canvas directory
cp /path/to/image.png ~/.openclaw/canvas/

# Push to canvas using the proxy path
openclaw nodes invoke --node <nodeId> --command canvas.present \
  --params '{"url":"/_canvas/image.png"}'
```

**Using the nodes tool:**
```
nodes action=invoke node=<nodeId> invokeCommand=canvas.present invokeParamsJson='{"url":"/_canvas/image.png"}'
```

The `/_canvas/*` path is proxied to the gateway's `/__openclaw__/canvas/*` endpoint.
Cove also auto-transforms localhost gateway URLs (e.g., `http://127.0.0.1:18789/__openclaw__/canvas/...`)
to the proxy path for backwards compatibility.

**Configuration:**

| Env Var | Default | Description |
|---------|---------|-------------|
| `GATEWAY_HOST` | `127.0.0.1` | Gateway hostname for canvas proxy |
| `GATEWAY_PORT` | `18789` | Gateway port |

**Common setups:**
- **Co-located (Cove + gateway same machine):** Works out of the box with defaults
- **Remote gateway:** Set `GATEWAY_HOST=your-gateway.local` to point to a different host
- **Behind Cloudflare/nginx:** The proxy strips `X-Forwarded-*` and `CF-*` headers so the gateway accepts the request as localhost

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
