## ⚡ Streaming Tool Call Fixes

Tool calls now render correctly during live streaming — no more text blocks merging together or tool call pills disappearing when the response finishes:

- **Text interleaving** — Text before and after tool calls stays properly separated during streaming, matching what you see after a page reload
- **Final event stability** — Tool call positions no longer break when the streaming run completes, so the layout doesn't flash or rearrange

---

## 🔒 Markdown Security & Stability

Two hardening improvements to the markdown renderer:

- **Remote image protection** — Model output containing remote image URLs (e.g., tracking pixels) no longer auto-fetches; they're rendered as clickable text links instead. Data URI images still display normally.
- **Crash fallback** — Malformed markdown that crashes the parser now falls back to plain text instead of breaking the entire message
