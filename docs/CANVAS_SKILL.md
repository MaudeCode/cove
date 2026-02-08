# Cove Canvas Skill

This document teaches agents how to use the Cove canvas feature to display content to users.

## Overview

When a user connects via Cove (OpenClaw's WebUI), a canvas panel is available for displaying rich content like images, HTML, and web pages. The canvas appears as a floating/dockable panel in the browser.

## How to Use

The canvas is accessed via the `nodes invoke` command targeting `node-host`:

```bash
openclaw nodes invoke --node node-host --command canvas.present --params '<JSON>'
```

## Commands

### canvas.present

Show content in the canvas panel. Opens the panel if closed.

**Display an image (base64):**
```bash
IMAGE_BASE64=$(base64 -i /path/to/image.png | tr -d '\n')
openclaw nodes invoke --node node-host --command canvas.present \
  --params "{\"imageBase64\":\"${IMAGE_BASE64}\",\"imageMimeType\":\"image/png\"}"
```

**Display HTML content (base64):**
```bash
HTML_BASE64=$(echo '<html><body><h1>Hello!</h1></body></html>' | base64 | tr -d '\n')
openclaw nodes invoke --node node-host --command canvas.present \
  --params "{\"imageBase64\":\"${HTML_BASE64}\",\"imageMimeType\":\"text/html\"}"
```

**Display a URL:**
```bash
openclaw nodes invoke --node node-host --command canvas.present \
  --params '{"url":"https://example.com"}'
```

### canvas.hide

Hide the canvas panel:
```bash
openclaw nodes invoke --node node-host --command canvas.hide
```

### canvas.navigate

Update the canvas content (same parameters as `canvas.present`):
```bash
openclaw nodes invoke --node node-host --command canvas.navigate \
  --params '{"url":"https://example.com"}'
```

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | string | URL to display in an iframe |
| `imageBase64` | string | Base64-encoded content (image or HTML) |
| `imageMimeType` | string | MIME type (e.g., `image/png`, `text/html`) |

## When to Use

- **Showing generated images** — Charts, diagrams, AI-generated images
- **Rich previews** — HTML mockups, styled content
- **Visual references** — Screenshots, diagrams from the web
- **Interactive content** — HTML with forms, animations

## Notes

- The canvas only works when the user is connected via Cove WebUI
- If `node-host` is not found, the user may need to refresh Cove
- Base64 is preferred over URLs to avoid CORS issues
- The user can drag, dock, minimize, and close the panel
