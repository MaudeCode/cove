# Cove Roadmap

Cove is a full-featured WebUI for OpenClaw.

## Phase 1: Foundation

### 1.1 Gateway Auth
- [ ] Password login form
- [ ] Token-based auth option
- [ ] Persistent session (remember me)
- [ ] Connection status indicator
- [ ] Logout
- [ ] Auto-reconnect on disconnect

### 1.2 Chat Interface
- [ ] Message list with scrolling
- [ ] Streaming text display (SSE/WebSocket)
- [ ] Tool call visualization (name, params, result, timing)
- [ ] Markdown rendering (GFM)
- [ ] Code blocks with syntax highlighting
- [ ] Copy code button
- [ ] Image/media display
- [ ] Input box with auto-resize
- [ ] Send with Enter / Shift+Enter for newline
- [ ] Keyboard shortcut (Cmd+Enter to send)
- [ ] File/image upload
- [ ] Loading/typing indicator
- [ ] Error handling (failed sends, retries)
- [ ] Reply/quote support (if channel supports)

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

---

## Tech Decisions

- [ ] State management (signals? preact hooks?)
- [ ] Styling (Tailwind? CSS modules? vanilla?)
- [ ] Component library (build custom? headless UI?)
- [ ] WebSocket vs SSE for streaming
- [ ] Routing (preact-router?)
- [ ] API client structure
