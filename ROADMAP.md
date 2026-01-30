# Cove Roadmap

Cove is a full-featured WebUI for OpenClaw.

---

## Phase 0: Infrastructure & Foundation

> **Complete all of Phase 0 before writing any feature code.**
> This phase establishes the patterns, utilities, and components everything else builds on.

### 0.1 Dependencies & Project Structure

**Install core dependencies:**
- [ ] `@preact/signals` — State management
- [ ] `preact-router` — Routing
- [ ] `tailwindcss` + `autoprefixer` + `postcss` — Styling
- [ ] `lucide-preact` — Icons
- [ ] `markdown-it` + plugins — Markdown rendering
- [ ] `prismjs` — Syntax highlighting
- [ ] `@floating-ui/dom` — Positioning for tooltips, popovers, dropdowns (framework-agnostic)
- [ ] Fonts: Geist, JetBrains Mono (via fontsource or CDN)

**Create directory structure:**
```
src/
├── components/
│   ├── ui/              # Primitives (Button, Input, Modal, Toast, Spinner, etc.)
│   └── chat/            # Chat-specific (Message, ToolCall, CodeBlock, etc.)
├── views/               # Full page views (Chat, Cron, Config, Status, Login)
├── lib/
│   ├── gateway.ts       # WebSocket client
│   ├── storage.ts       # localStorage wrapper (typed)
│   ├── i18n.ts          # Localization utilities
│   ├── markdown.ts      # Markdown renderer setup
│   ├── prism.ts         # Syntax highlighting setup
│   ├── time.ts          # Date/time formatting utilities
│   └── utils.ts         # General utilities
├── hooks/               # Custom Preact hooks
├── signals/
│   ├── auth.ts          # Auth state (connected, token, etc.)
│   ├── sessions.ts      # Session list and active session
│   ├── settings.ts      # User preferences (theme, locale, etc.)
│   └── ui.ts            # UI state (sidebar open, modals, etc.)
├── styles/
│   ├── tailwind.css     # Tailwind imports + base styles
│   ├── themes.css       # CSS variables for theming
│   ├── fonts.css        # Font-face declarations
│   └── animations.css   # Custom animations
├── types/
│   ├── gateway.ts       # Gateway protocol types
│   ├── messages.ts      # Message/chat types
│   ├── sessions.ts      # Session types
│   └── settings.ts      # Settings types
└── locales/
    ├── en.json          # English strings
    └── index.ts         # Locale loader
```

**Configure build tools:**
- [ ] Vite path aliases (`@/` → `src/`)
- [ ] TypeScript strict mode
- [ ] Tailwind purge config

---

### 0.2 Tailwind & Theming Foundation

**Tailwind setup:**
- [ ] Install and configure Tailwind with Vite
- [ ] Set up `tailwind.config.ts` with custom theme
- [ ] Configure content paths for purging

**CSS custom properties for theming:**
```css
:root {
  /* Backgrounds */
  --color-bg-primary: ...;
  --color-bg-secondary: ...;
  --color-bg-surface: ...;
  
  /* Text */
  --color-text-primary: ...;
  --color-text-secondary: ...;
  --color-text-muted: ...;
  
  /* Accent */
  --color-accent: ...;
  --color-accent-hover: ...;
  
  /* Status */
  --color-success: ...;
  --color-warning: ...;
  --color-error: ...;
  
  /* Borders */
  --color-border: ...;
  --radius-sm: ...;
  --radius-md: ...;
  --radius-lg: ...;
  
  /* Shadows */
  --shadow-sm: ...;
  --shadow-md: ...;
  
  /* Fonts */
  --font-sans: ...;
  --font-mono: ...;
  
  /* Spacing */
  --sidebar-width: ...;
  --topbar-height: ...;
}

[data-theme="dark"] { ... }
[data-theme="light"] { ... }
```

**Checklist:**
- [ ] Define complete color palette (light + dark)
- [ ] Define typography scale
- [ ] Define spacing/sizing tokens
- [ ] Test contrast ratios for a11y compliance
- [ ] Add `prefers-reduced-motion` support
- [ ] Add `prefers-color-scheme` detection

---

### 0.3 Internationalization (i18n) Infrastructure

**Core utilities (`lib/i18n.ts`):**
- [ ] `t(key, params?)` — Translate a string with optional interpolation
- [ ] `setLocale(locale)` — Switch locale
- [ ] `getLocale()` — Get current locale
- [ ] `formatDate(date, style)` — Locale-aware date formatting
- [ ] `formatTime(date, style)` — Locale-aware time formatting
- [ ] `formatRelativeTime(date)` — "2 hours ago" etc.
- [ ] `formatNumber(num, options)` — Locale-aware number formatting

**String extraction pattern:**
```tsx
// All user-facing strings use t()
<button aria-label={t('actions.newChat')}>{t('actions.newChat')}</button>

// With interpolation
<p>{t('messages.count', { count: 5 })}</p>  // "5 messages"

// Pluralization
<p>{t('sessions.count', { count })}</p>  // "1 session" / "5 sessions"
```

**Locale files structure:**
```json
{
  "actions": {
    "newChat": "New Chat",
    "send": "Send",
    "cancel": "Cancel"
  },
  "errors": {
    "connectionFailed": "Connection failed",
    "unauthorized": "Invalid credentials"
  }
}
```

**Checklist:**
- [ ] Create `lib/i18n.ts` with core functions
- [ ] Create `locales/en.json` with initial strings
- [ ] Create locale loader with lazy loading support
- [ ] Add RTL detection and `dir` attribute support
- [ ] Create signal for current locale
- [ ] Test with pseudo-locale for string coverage

---

### 0.4 Gateway WebSocket Client

**Core client (`lib/gateway.ts`):**
- [ ] WebSocket connection management
- [ ] Auto-reconnect with exponential backoff
- [ ] Connection state signal (connecting, connected, disconnected, error)
- [ ] Request/response with Promise API
- [ ] Event subscription system
- [ ] Typed protocol messages

**Protocol (matching OpenClaw):**
```ts
// Requests
interface GatewayRequest {
  type: 'req'
  id: string
  method: string
  params?: unknown
}

// Responses
interface GatewayResponse {
  type: 'res'
  id: string
  ok: boolean
  payload?: unknown
  error?: { message: string; code?: string }
}

// Events
interface GatewayEvent {
  type: 'event'
  event: string
  payload?: unknown
  seq?: number
}
```

**API surface:**
```ts
class GatewayClient {
  // Connection
  connect(url: string, auth: AuthConfig): Promise<void>
  disconnect(): void
  
  // State (signals)
  readonly state: Signal<ConnectionState>
  readonly error: Signal<string | null>
  
  // RPC
  request<T>(method: string, params?: unknown): Promise<T>
  
  // Events
  on(event: string, handler: (payload: unknown) => void): () => void
  
  // Streaming
  onChatStream(handler: (chunk: StreamChunk) => void): () => void
  onToolEvent(handler: (event: ToolEvent) => void): () => void
}
```

**Checklist:**
- [ ] Implement connection lifecycle
- [ ] Implement auto-reconnect with backoff (800ms → 15s max)
- [ ] Implement request/response correlation (by id)
- [ ] Implement event dispatching
- [ ] Implement chat streaming handling
- [ ] Implement tool event handling
- [ ] Add connection timeout handling
- [ ] Add heartbeat/ping support (if protocol supports)
- [ ] Full TypeScript types for all protocol messages
- [ ] Unit tests for client logic

---

### 0.5 Storage Utilities

**Typed localStorage wrapper (`lib/storage.ts`):**
```ts
interface StorageSchema {
  settings: UserSettings
  auth: AuthState
  recentSessions: string[]
}

function get<K extends keyof StorageSchema>(key: K): StorageSchema[K] | null
function set<K extends keyof StorageSchema>(key: K, value: StorageSchema[K]): void
function remove(key: keyof StorageSchema): void
function clear(): void
```

**Checklist:**
- [ ] Create typed storage wrapper
- [ ] Add JSON parse/stringify with error handling
- [ ] Add migration support for schema changes
- [ ] Create settings signal that syncs with storage
- [ ] Test storage quota handling

---

### 0.6 Base UI Components

> All components must have: ARIA labels, keyboard support, CSS variable theming, i18n strings.

**Primitives (`components/ui/`):**

| Component | Props | Notes |
|-----------|-------|-------|
| `Button` | variant, size, disabled, loading, icon | Primary, secondary, ghost, danger variants |
| `IconButton` | icon, label, size | Accessible icon-only button |
| `Input` | type, placeholder, error, disabled | Text, password, search |
| `Textarea` | placeholder, rows, autoResize | Auto-growing textarea |
| `Select` | options, value, onChange | Accessible select dropdown |
| `Checkbox` | checked, label, disabled | With visible label |
| `Toggle` | checked, label, disabled | Switch/toggle component |
| `Modal` | open, onClose, title | Focus trap, escape to close |
| `Drawer` | open, onClose, side | Slide-in panel (for mobile sidebar) |
| `Toast` | message, type, duration | Success, error, warning, info |
| `ToastContainer` | position | Manages toast stack |
| `Tooltip` | content, side | Accessible tooltip |
| `Spinner` | size | Loading spinner |
| `Skeleton` | width, height | Loading placeholder |
| `Badge` | variant, label | Status badges |
| `Avatar` | src, fallback, size | User/assistant avatar |
| `Divider` | orientation | Horizontal/vertical divider |

**Layout (`components/ui/`):**

| Component | Props | Notes |
|-----------|-------|-------|
| `Stack` | direction, gap, align | Flex container |
| `ScrollArea` | orientation | Custom scrollbar styling |
| `Collapsible` | open, onToggle, title | Expandable section |
| `ResizablePanel` | minSize, maxSize | Draggable resize handle |

**Checklist for each component:**
- [ ] TypeScript props interface
- [ ] ARIA attributes (role, labels, states)
- [ ] Keyboard navigation (Tab, Enter, Escape, Arrow keys as appropriate)
- [ ] Focus visible styles
- [ ] CSS variable usage (no hardcoded colors)
- [ ] Forwarded refs where needed
- [ ] Loading/disabled states
- [ ] All text via `t()` function

---

### 0.7 Markdown & Code Rendering

**Markdown setup (`lib/markdown.ts`):**
- [ ] Configure markdown-it with GFM
- [ ] Add admonition/callout plugin (NOTE, WARNING, TIP, etc.)
- [ ] Add syntax highlighting integration (Prism)
- [ ] Sanitize HTML output
- [ ] Support for rendering to Preact VNodes (not just HTML string)

**Code block component (`components/ui/CodeBlock.tsx`):**
- [ ] Syntax highlighting via Prism
- [ ] Language label
- [ ] Copy button with feedback
- [ ] Line numbers (optional)
- [ ] Line highlighting (optional)
- [ ] Wrap/scroll toggle for long lines

**Prism setup (`lib/prism.ts`):**
- [ ] Load only needed languages (lazy)
- [ ] Theme via CSS variables
- [ ] Languages: javascript, typescript, tsx, jsx, json, bash, python, rust, go, yaml, markdown, diff

**Checklist:**
- [ ] Markdown renders correctly (headings, lists, links, images, tables)
- [ ] Admonitions render with proper styling
- [ ] Code blocks have syntax highlighting
- [ ] Copy button works
- [ ] Dark/light theme applies to code

---

### 0.8 Time & Date Utilities

**Time utilities (`lib/time.ts`):**
```ts
// Formatting
formatDate(date: Date, style: 'short' | 'medium' | 'long'): string
formatTime(date: Date, style: 'short' | 'medium'): string
formatDateTime(date: Date): string

// Relative time
formatRelative(date: Date): string  // "2 hours ago", "in 5 minutes"

// User preference aware
formatTimestamp(date: Date, preference: 'relative' | 'local'): string
```

**Checklist:**
- [ ] All formatting uses `Intl` APIs
- [ ] Locale-aware formatting
- [ ] User preference for relative vs absolute time
- [ ] Handle timezone correctly
- [ ] Update relative times periodically (signal or interval)

---

### 0.9 Global Signals Setup

**Auth signals (`signals/auth.ts`):**
```ts
export const gatewayUrl = signal<string>('')
export const authToken = signal<string | null>(null)
export const connectionState = signal<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected')
export const connectionError = signal<string | null>(null)
export const isAuthenticated = computed(() => connectionState.value === 'connected')
```

**Settings signals (`signals/settings.ts`):**
```ts
export const theme = signal<'light' | 'dark' | 'system'>('system')
export const locale = signal<string>('en')
export const timeFormat = signal<'relative' | 'local'>('relative')
export const fontSize = signal<'sm' | 'md' | 'lg'>('md')
export const fontFamily = signal<string>('geist')
```

**UI signals (`signals/ui.ts`):**
```ts
export const sidebarOpen = signal<boolean>(true)
export const activeView = signal<'chat' | 'cron' | 'config' | 'status'>('chat')
export const activeModal = signal<string | null>(null)
export const toasts = signal<Toast[]>([])
```

**Sessions signals (`signals/sessions.ts`):**
```ts
export const sessions = signal<Session[]>([])
export const activeSessionKey = signal<string | null>(null)
export const activeSession = computed(() => 
  sessions.value.find(s => s.key === activeSessionKey.value)
)
```

**Checklist:**
- [ ] All signals defined with proper types
- [ ] Computed signals for derived state
- [ ] Settings signals sync with localStorage
- [ ] Auth signals sync with gateway client

---

### 0.10 Error Handling Infrastructure

**Toast system:**
- [ ] `showToast(message, type, duration?)` function
- [ ] Toast queue management (max visible, auto-dismiss)
- [ ] Toast types: success, error, warning, info
- [ ] Accessible announcements (aria-live)

**Error boundary:**
- [ ] Create ErrorBoundary component
- [ ] Fallback UI with retry option
- [ ] Error logging/reporting hook

**Inline error component:**
- [ ] `<InlineError message={...} onRetry={...} />`
- [ ] For use in chat view

**Checklist:**
- [ ] Toast container positioned correctly
- [ ] Toasts are keyboard dismissible
- [ ] Error boundary catches render errors
- [ ] Errors are logged for debugging

---

## Phase 1: Core Features

> All Phase 0 items must be complete before starting Phase 1.

### 1.1 Layout Shell

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

**Components:**
- [ ] `<AppShell>` — Main layout container
- [ ] `<TopBar>` — Logo, connection status, theme toggle, settings
- [ ] `<Sidebar>` — Sessions list, nav sections
- [ ] `<MainContent>` — View container with routing

**Sidebar behavior:**
- [ ] New Chat button (prominent, top)
- [ ] Sessions section (expandable, scrollable)
  - [ ] Session list with active indicator
  - [ ] Search/filter sessions
  - [ ] Grouped by time (Today, Yesterday, etc.) or flat list
- [ ] Bottom sections (pinned, collapsible)
  - [ ] Cron Jobs
  - [ ] Config
  - [ ] Status
- [ ] Click section → navigates to that view

**TopBar behavior:**
- [ ] Logo/branding (links to chat)
- [ ] Gateway health indicator (connected/disconnected, latency)
- [ ] Theme toggle (light/dark/system)
- [ ] Settings gear (opens settings modal)

**Responsive behavior:**
- [ ] Desktop (>1024px): Sidebar always visible
- [ ] Tablet (768-1024px): Sidebar collapsible
- [ ] Mobile (<768px): Sidebar as drawer, hamburger menu

---

### 1.2 Gateway Auth

**Login view (`views/Login.tsx`):**
- [ ] Gateway URL input
- [ ] Auth mode toggle (password vs token)
- [ ] Password input (when password mode)
- [ ] Token input (when token mode)
- [ ] "Remember me" checkbox
- [ ] Connect button with loading state
- [ ] Error display (invalid credentials, connection failed)
- [ ] Auto-connect on load if saved credentials

**Auth flow:**
- [ ] Validate inputs before connecting
- [ ] Show connecting state
- [ ] Handle auth errors gracefully
- [ ] On success: save to storage, redirect to chat
- [ ] On failure: show error, allow retry

**Session persistence:**
- [ ] Save gateway URL + auth to localStorage
- [ ] Auto-reconnect on page reload
- [ ] Clear on logout

**Logout:**
- [ ] Disconnect from gateway
- [ ] Clear stored credentials (optional based on "remember me")
- [ ] Redirect to login

---

### 1.3 Chat Interface

**Core Principle: Streaming = History**
> Streaming messages MUST use the same data structure and components as history messages.
> No visual difference between a just-streamed message and one loaded from history.
> No refresh required after streaming ends. The message is already in final form.

**Message types (`types/messages.ts`):**
```ts
interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  toolCalls?: ToolCall[]
  timestamp: number
  isStreaming?: boolean
}

interface ToolCall {
  id: string
  name: string
  args?: Record<string, unknown>
  result?: unknown
  status: 'pending' | 'running' | 'complete' | 'error'
  startedAt?: number
  completedAt?: number
}
```

**Components (`components/chat/`):**

| Component | Purpose |
|-----------|---------|
| `ChatView` | Main chat view container |
| `MessageList` | Scrollable message container |
| `ChatMessage` | Single message (user or assistant) |
| `MessageContent` | Rendered markdown content |
| `ToolCallList` | List of tool calls in a message |
| `ToolCall` | Single tool call (collapsible) |
| `ToolCallSummary` | Compact view ("read file.ts") |
| `ToolCallDetails` | Expanded view (params, result, diff) |
| `ChatInput` | Message input with send button |
| `TypingIndicator` | Shows while streaming |

**Chat input behavior:**
- [ ] Auto-resize textarea
- [ ] Send with Enter (Shift+Enter for newline)
- [ ] Cmd/Ctrl+Enter always sends
- [ ] Disabled while sending/streaming
- [ ] Character count (optional)

**Message list behavior:**
- [ ] Auto-scroll to bottom on new messages
- [ ] Scroll-to-bottom button when scrolled up
- [ ] Smooth scrolling
- [ ] Loading state for history fetch

**Streaming behavior:**
- [ ] Chunks append to current message
- [ ] Tool events update tool calls in message
- [ ] Typing indicator while streaming
- [ ] On complete: message is already in final form

**Tool call visualization:**
- [ ] Compact summary: icon + "read src/app.tsx" + duration
- [ ] Click to expand details
- [ ] File reads: show file content (scrollable, syntax highlighted)
- [ ] File edits: show diff view
- [ ] Errors: show error message with red styling

**Markdown rendering:**
- [ ] GFM (tables, strikethrough, autolinks)
- [ ] Admonitions (NOTE, WARNING, TIP, etc.)
- [ ] Code blocks with syntax highlighting
- [ ] Copy button on code blocks
- [ ] Rendered vs raw toggle

**Error handling:**
- [ ] Failed send: inline error with retry button
- [ ] Connection lost: show banner, queue messages
- [ ] On reconnect: resend queued messages

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
| Positioning | @floating-ui/dom | Framework-agnostic, custom Preact hook wrapper |
| Theming | CSS custom properties | Build with variables from day one for full theming support |
| Icons | Lucide (lucide-preact) | Tree-shakeable, only used icons bundled |
| Fonts | Geist (default) + options | Inter, System, JetBrains Mono, OpenDyslexic |
| Error UX | Inline (chat) + Toasts | Desktop notifications opt-in |
| i18n | Built-in from start | String extraction, RTL support ready |
| Testing | Deferred | Add once architecture stabilizes |
| Linting | oxlint | Rust-based, jsx-a11y, import, react, typescript plugins |
| Formatting | oxfmt | Prettier-compatible, built-in Tailwind + import sorting |
| Tailwind linting | eslint-plugin-better-tailwindcss | Unknown/conflicting class detection |
| Commit linting | commitlint | Conventional commits enforced via husky |
| Date/time | Native Intl APIs | User option: local time vs relative ("2h ago") |
| Animations | Tailwind + custom CSS | No heavy libs, add motion later if needed |
| Package manager | Bun | Fast, modern |
| License | MIT | |
| Distribution | npm, Docker, git | Document/implement later |
