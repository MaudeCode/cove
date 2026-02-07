## 📅 New Versioning: Calver

Starting with this release, Cove uses **calendar versioning** that matches OpenClaw releases:

- `v1.3.0` → `v2026.2.6`
- Version now indicates OpenClaw compatibility (e.g., `2026.2.6` works with OpenClaw February 2026 releases)
- Patch releases use suffix: `2026.2.6-1`, `2026.2.6-2`, etc.

This makes it easy to know which Cove version works with your OpenClaw installation.

---

## 📊 Usage Page Overhaul

The Stats page has been completely redesigned and renamed to **Usage** with powerful new analytics:

- **Per-session analytics** — See token usage and costs broken down by session
- **Session detail modal** — Token breakdown with context weight visualization
- **Sortable columns** — Sort by cost, tokens, or recent activity
- **Mobile responsive** — Card-based layout on small screens with swipe-friendly design
- **Caching** — Instant page loads with localStorage caching

### Also in this release

- **Accessibility fixes** — Proper `<button>` elements for sortable table headers
- **Component extraction** — Cleaner codebase with reusable usage components
- **Dependency updates** — Preact 10.28.3, @preact/signals 2.7.0, Vite 7.3.1
