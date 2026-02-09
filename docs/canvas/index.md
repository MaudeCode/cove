# Canvas Setup Guide

This guide explains how to set up the canvas feature so agents can display images and content in Cove.

## Requirements

- OpenClaw gateway (2026.2.0+)
- Cove WebUI

## 1. Gateway Configuration

The canvas host must be enabled in your gateway config (`~/.openclaw/openclaw.json`):

```json
{
  "canvasHost": {
    "enabled": true
  }
}
```

If Cove runs on a different machine or in Docker, set `bind` to `"lan"`:

```json
{
  "bind": "lan"
}
```

Restart the gateway after config changes.

## 2. Enable Canvas in Cove

1. Open Cove in your browser
2. Go to **Settings**
3. Enable **Canvas Node**
4. Optionally set a custom display name

Cove will register as a node with the gateway. You may need to approve it on first connection.

## 3. Place Files for Display

Copy images or HTML files to the gateway's canvas directory:

```bash
cp image.png ~/.openclaw/canvas/
```

## 4. Display Content

Agents can push content using the `/_canvas/` path:

```
nodes action=invoke node=<nodeId> invokeCommand=canvas.present invokeParamsJson='{"url":"/_canvas/image.png"}'
```

To find connected nodes:
```
nodes action=status
```

Look for nodes with `canvas` in their capabilities.

## Troubleshooting

**Node not appearing:**
- Check Canvas Node is enabled in Cove settings
- Refresh the browser
- Check gateway logs for connection errors

**401 errors on images:**
- Ensure gateway `bind` is set correctly for your network
- Verify the file exists in `~/.openclaw/canvas/`

**Content not displaying:**
- Check browser console for errors
- Try a simple image first before complex HTML
