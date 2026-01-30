# Cove Roadmap

Cove is a full-featured WebUI for OpenClaw.

## Phase 1: Foundation

### 0.0 Project Structure

```
src/
├── components/        # Reusable UI components
│   ├── ui/            # Primitives (Button, Input, Modal, Toast, etc.)
│   └── chat/          # Chat-specific (Message, ToolCall, Input, etc.)
├── views/             # Full page views (Chat, Cron, Config, Status)
├── lib/               # Gateway client, storage, utils
│   ├── gateway.ts     # WebSocket client
│   ├── storage.ts     # localStorage wrapper
│   └── i18n.ts        # Localization
├── hooks/             # Custom Preact hooks (if needed alongside signals)
├── signals/           # Global state (signals)
├── styles/            # Tailwind config, global styles, fonts
└── types/             # TypeScript types
```

### 0.1 Core Principles

**Accessibility (a11y)**
- [ ] ARIA labels on all interactive elements
- [ ] Keyboard navigation throughout
- [ ] Focus management (modals, drawers)
- [ ] Screen reader friendly
- [ ] Color contrast compliance
- [ ] Reduced motion support

**Internationalization (i18n)**
- [ ] All user-facing strings extracted
- [ ] Locale switching support
- [ ] RTL layout support
- [ ] Date/time/number formatting by locale

**Error Handling**
- [ ] Chat view: inline errors
- [ ] Other views: toast notifications
- [ ] Desktop notifications (opt-in)
- [ ] Error boundaries for graceful failure

### 1.0 Layout Structure

```
┌──────────────────────────────────────────────────────────────┐
│ [Logo/Cove]   Gateway: ●  Connected      [Theme] [Settings]  │
├────────────────┬─────────────────────────────────────────────┤
│                │                                             │
│ [+ New Chat]   │                                             │
│                │                                             │
│ ▼ Sessions     │                                             │
│ ┌────────────┐ │                                             │
│ │ ● Main     │ │           Main content area                 │
│ │   Debug    │ │           (Chat, Cron, Config, etc.)        │
│ │   Test     │ │                                             │
│ │   ...      │ │                                             │
│ │ (scroll)   │ │                                             │
│ └────────────┘ │                                             │
│                │                                             │
│────────────────│                                             │
│ ▶ Cron Jobs    │                                             │
│ ▶ Config       │─────────────────────────────────────────────│
│ ▶ Status       │ [Input box - when in chat view]             │
│                │                                             │
└────────────────┴─────────────────────────────────────────────┘
```

**Sidebar (left)**
- [ ] New Chat button (prominent, top)
- [ ] Sessions section (expandable, scrollable)
  - [ ] Session list with active indicator
  - [ ] Search/filter sessions
  - [ ] Grouped by time (Today, Yesterday, etc.) or flat list
- [ ] Bottom sections (pinned, collapsible)
  - [ ] Cron Jobs
  - [ ] Config
  - [ ] Status
- [ ] Click section → navigates to that view in main content area

**Top bar**
- [ ] Logo/branding
- [ ] Gateway health indicator (connected/disconnected, latency?)
- [ ] Theme toggle
- [ ] Settings gear

**Main content area**
- [ ] Renders current view (Chat, Cron, Config, Status)
- [ ] Full height minus top bar
- [ ] When in Chat: input box pinned to bottom

**Responsive behavior**
- [ ] Desktop: Sidebar always visible
- [ ] Tablet: Sidebar collapsible
- [ ] Mobile: Sidebar as drawer, hamburger menu

### 1.1 Gateway Auth
- [ ] Password login form
- [ ] Token-based auth option
- [ ] Persistent session (remember me)
- [ ] Connection status indicator
- [ ] Logout
- [ ] Auto-reconnect on disconnect

### 1.2 Chat Interface

**Core Principle: Streaming = History**
> Streaming messages MUST use the same data structure and components as history messages.
> No visual difference between a just-streamed message and one loaded from history.
> No refresh required after streaming ends. The message is already in final form.

- [ ] Single `Message` type for both streaming and history
- [ ] Single `<ChatMessage>` component renders both (only cosmetic difference: typing indicator)
- [ ] Tool calls rendered identically during stream and in history
- [ ] Message list with scrolling
- [ ] Streaming text display (WebSocket)
- [ ] Tool call visualization
  - [ ] Compact summary view (e.g., "read <file>", "edited <file>")
  - [ ] Click to expand full details
  - [ ] File reads: show file content
  - [ ] File edits: show diff view
  - [ ] Show timing/duration
- [ ] Markdown rendering (GFM)
  - [ ] GitHub-style admonitions (NOTE, WARNING, etc.)
  - [ ] Rendered vs raw source toggle
- [ ] Code blocks with syntax highlighting
- [ ] Copy code button
- [ ] Image/media display
- [ ] Input box with auto-resize
- [ ] Send with Enter / Shift+Enter for newline
- [ ] Keyboard shortcut (Cmd+Enter to send)
- [ ] Loading/typing indicator
- [ ] Error handling (failed sends, retries)

---

## Phase 2: Session & History

### 2.1 Session Management
- [ ] List all sessions (main, isolated, sub-agents)
- [ ] Session metadata (model, channel, created, last active)
- [ ] Switch between sessions
- [ ] Session status card (usage, cost, tokens, model override)
- [ ] Create new session
- [ ] Delete/archive session
- [ ] Session labels/renaming
- [ ] Filter by kind (main/isolated/channel)

### 2.2 Session History
- [ ] View past messages in session
- [ ] Infinite scroll / pagination
- [ ] Search within session
- [ ] Search across all sessions
- [ ] Filter by date range
- [ ] Export conversation (JSON, Markdown, PDF?)

### 2.3 Chat Enhancements
- [ ] File/image upload (drag-drop, paste, preview)
- [ ] Reply/quote support (if channel supports)

---

## Phase 3: Operations

### 3.1 Status Dashboard
- [ ] Gateway health (uptime, version, pid)
- [ ] Connected channels with status
- [ ] Current model info
- [ ] Active sessions count
- [ ] Recent activity feed
- [ ] Node status (if any paired)
- [ ] Error/warning alerts
- [ ] Quick actions (restart gateway, etc.)

### 3.2 Cron Job Management
- [ ] List all jobs (enabled/disabled)
- [ ] Job details (schedule, payload, target)
- [ ] Create new job
  - [ ] Schedule types: at, every, cron
  - [ ] Payload types: systemEvent, agentTurn
  - [ ] Session target picker
- [ ] Edit existing jobs
- [ ] Delete jobs
- [ ] Enable/disable toggle
- [ ] Run job manually (trigger now)
- [ ] View run history (timestamps, outcomes)
- [ ] Next run preview

### 3.3 Configuration Editor
- [ ] View current config (formatted JSON)
- [ ] Edit with syntax highlighting
- [ ] Schema-aware validation
- [ ] Diff view before applying
- [ ] Apply config (with restart)
- [ ] Config backup before changes

---

## Phase 4: Nice to Have

### 4.1 Memory Browser
- [ ] Tree view of MEMORY.md + memory/*.md
- [ ] View file contents
- [ ] Edit in-place
- [ ] Search across memory files
- [ ] Git history view (if repo)

### 4.2 Skills Browser
- [ ] List available skills
- [ ] View skill description & location
- [ ] View SKILL.md contents
- [ ] Trigger/invoke skill (?)

### 4.3 Node Management
- [ ] List paired nodes
- [ ] Node status (online/offline, last seen)
- [ ] Send notification
- [ ] Trigger camera snap
- [ ] Request location
- [ ] Screen recording controls

### 4.4 Real-time Activity Feed
- [ ] Live stream of gateway events
- [ ] Tool calls with timing
- [ ] Message sends/receives
- [ ] Cron job runs
- [ ] Filterable by type

### 4.5 Usage Analytics
- [ ] Token usage over time (chart)
- [ ] Cost tracking per session/day/model
- [ ] Model usage breakdown
- [ ] Export reports

### 4.6 Multi-Session View
- [ ] Split pane layout
- [ ] Monitor multiple sessions
- [ ] Drag/drop session arrangement

### 4.7 Browser Automation Viewer
- [ ] View snapshots from browser tool
- [ ] Screenshot gallery
- [ ] Interactive element highlighting

### 4.8 Sub-Agent Spawner
- [ ] UI to spawn background tasks
- [ ] Select agent, model, task
- [ ] Monitor progress
- [ ] View results when complete

### 4.9 UX Polish
- [ ] Dark/light theme toggle
- [ ] Mobile responsive
- [ ] Keyboard shortcuts (global navigation)
- [ ] Customizable layout
- [ ] Notifications (desktop/browser)

### 4.10 PWA Support
- [ ] manifest.json (app name, icons, theme colors, display mode)
- [ ] Service worker for install prompt
- [ ] Offline caching (optional)
- [ ] iOS/Android home screen install support

### 4.11 Custom Theming
- [ ] Theme schema (colors, code theme, fonts, spacing)
- [ ] Built-in theme presets (light, dark, etc.)
- [ ] Theme editor UI (color pickers, live preview)
- [ ] Save/load custom themes
- [ ] Import/export themes (share with others)
- [ ] Prism theme synced to app theme

---

## Tech Decisions ✅

| Decision | Choice | Notes |
|----------|--------|-------|
| State management | Preact Signals | Fine-grained reactivity, native to Preact |
| Styling | Tailwind CSS | Utility-first, great Vite integration |
| Component library | Custom | Build as we go, extract patterns |
| Streaming | WebSocket | Match OpenClaw gateway protocol |
| Routing | preact-router | Official, stable, simple API |
| API client | Custom typed client | JSON-RPC over WebSocket, auto-reconnect |
| Storage | localStorage | Settings, auth, session key persistence |
| Syntax highlighting | Prism | Lightweight, themeable |
| Markdown | markdown-it | Pluggable, GFM support, good features |
| Theming | CSS custom properties | Build with variables from day one for full theming support |
| Icons | Lucide (lucide-preact) | Tree-shakeable, only used icons bundled |
| Fonts | Geist (default) + options | Inter, System, JetBrains Mono, OpenDyslexic |
| Error UX | Inline (chat) + Toasts | Desktop notifications opt-in |
| i18n | Built-in from start | String extraction, RTL support ready |
| Testing | Deferred | Add once architecture stabilizes |
