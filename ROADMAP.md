# Cove Roadmap

Cove is a full-featured WebUI for OpenClaw.

---

## Phase 0: Infrastructure & Foundation

> **Complete all of Phase 0 before writing any feature code.**
> This phase establishes the patterns, utilities, and components everything else builds on.

### 0.1 Dependencies & Project Structure ✅

**Install core dependencies:**
- [x] `@preact/signals` — State management
- [x] `preact-router` — Routing
- [x] `tailwindcss` + `autoprefixer` + `postcss` — Styling
- [x] `lucide-preact` — Icons
- [x] `markdown-it` + plugins — Markdown rendering
- [x] `prismjs` — Syntax highlighting
- [x] `@floating-ui/dom` — Positioning for tooltips, popovers, dropdowns (framework-agnostic)
- [x] Fonts: Geist, JetBrains Mono (via fontsource or CDN)

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
- [x] Vite path aliases (`@/` → `src/`)
- [x] TypeScript strict mode
- [x] Tailwind purge config

---

### 0.2 Tailwind & Theming Foundation ✅

**Tailwind setup:**
- [x] Install and configure Tailwind with Vite
- [x] Set up `tailwind.config.ts` with custom theme
- [x] Configure content paths for purging

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
- [x] Define complete color palette (light + dark)
- [x] Define typography scale
- [x] Define spacing/sizing tokens
- [ ] Test contrast ratios for a11y compliance
- [ ] Add `prefers-reduced-motion` support
- [x] Add `prefers-color-scheme` detection

---

### 0.3 Internationalization (i18n) Infrastructure ✅

**Core utilities (`lib/i18n.ts`):**
- [x] `t(key, params?)` — Translate a string with optional interpolation
- [x] `setLocale(locale)` — Switch locale
- [x] `getLocale()` — Get current locale
- [x] `formatDate(date, style)` — Locale-aware date formatting
- [x] `formatTime(date, style)` — Locale-aware time formatting
- [x] `formatRelativeTime(date)` — "2 hours ago" etc.
- [x] `formatNumber(num, options)` — Locale-aware number formatting

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
- [x] Create `lib/i18n.ts` with core functions
- [x] Create `locales/en.json` with initial strings
- [x] Create locale loader with lazy loading support
- [x] Add RTL detection and `dir` attribute support
- [x] Create signal for current locale
- [ ] Test with pseudo-locale for string coverage

---

### 0.4 Gateway WebSocket Client ✅

**Core client (`lib/gateway.ts`):**
- [x] WebSocket connection management
- [x] Auto-reconnect with exponential backoff
- [x] Connection state signal (connecting, connected, disconnected, error)
- [x] Request/response with Promise API
- [x] Event subscription system
- [x] Typed protocol messages

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
- [x] Implement connection lifecycle
- [x] Implement auto-reconnect with backoff (800ms → 15s max)
- [x] Implement request/response correlation (by id)
- [x] Implement event dispatching
- [x] Implement chat streaming handling
- [x] Implement tool event handling
- [x] Add connection timeout handling
- [x] Add heartbeat/ping support (if protocol supports)
- [x] Full TypeScript types for all protocol messages
- [ ] Unit tests for client logic

---

### 0.5 Storage Utilities ✅

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
- [x] Create typed storage wrapper
- [x] Add JSON parse/stringify with error handling
- [x] Add migration support for schema changes
- [x] Create settings signal that syncs with storage
- [x] Test storage quota handling

---

### 0.6 Base UI Components ✅

> All components must have: ARIA labels, keyboard support, CSS variable theming, i18n strings.

**Primitives (`components/ui/`):**

| Component | Status | Notes |
|-----------|--------|-------|
| `Button` | ✅ | Primary, secondary, ghost, danger variants |
| `IconButton` | ✅ | Accessible icon-only button |
| `Input` | ✅ | With error state, left/right elements |
| `Textarea` | ⏳ | Using ChatInput for now |
| `Select` | ✅ | Accessible select dropdown |
| `Checkbox` | ⏳ | Deferred |
| `Toggle` | ✅ | Switch/toggle with label/description |
| `Modal` | ✅ | Focus trap, escape to close |
| `Drawer` | ⏳ | Using Sidebar mobile mode |
| `Toast` | ✅ | Success, error, warning, info |
| `ToastContainer` | ✅ | Manages toast stack |
| `Tooltip` | ⏳ | Deferred |
| `Spinner` | ✅ | Loading spinner |
| `Skeleton` | ✅ | Loading placeholder + SkeletonText, SkeletonAvatar |
| `Badge` | ✅ | Status badges with variants |
| `Avatar` | ⏳ | Deferred |
| `Divider` | ⏳ | Using border classes |

**Layout (`components/ui/`):**

| Component | Status | Notes |
|-----------|--------|-------|
| `Stack` | ⏳ | Using flex classes |
| `ScrollArea` | ⏳ | Using overflow-auto |
| `Collapsible` | ⏳ | Deferred |
| `ResizablePanel` | ⏳ | Deferred |

**Checklist for each component:**
- [x] TypeScript props interface
- [x] ARIA attributes (role, labels, states)
- [x] Keyboard navigation (Tab, Enter, Escape, Arrow keys as appropriate)
- [x] Focus visible styles
- [x] CSS variable usage (no hardcoded colors)
- [x] Forwarded refs where needed
- [x] Loading/disabled states
- [x] All text via `t()` function

---

### 0.7 Markdown & Code Rendering ✅

**Markdown setup (`lib/markdown.ts`):**
- [x] Configure markdown-it with GFM
- [ ] Add admonition/callout plugin (NOTE, WARNING, TIP, etc.)
- [x] Add syntax highlighting integration (Prism)
- [x] Sanitize HTML output
- [ ] Support for rendering to Preact VNodes (not just HTML string)

**Code block component (`components/chat/MessageContent.tsx`):**
- [x] Syntax highlighting via Prism
- [ ] Language label
- [x] Copy button with feedback
- [ ] Line numbers (optional)
- [ ] Line highlighting (optional)
- [ ] Wrap/scroll toggle for long lines

**Prism setup (`lib/markdown.ts`):**
- [x] Load only needed languages (lazy)
- [ ] Theme via CSS variables
- [ ] Languages: javascript, typescript, tsx, jsx, json, bash, python, rust, go, yaml, markdown, diff

**Checklist:**
- [x] Markdown renders correctly (headings, lists, links, images, tables)
- [ ] Admonitions render with proper styling
- [x] Code blocks have syntax highlighting
- [x] Copy button works
- [x] Dark/light theme applies to code

---

### 0.8 Time & Date Utilities ✅

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
- [x] All formatting uses `Intl` APIs
- [x] Locale-aware formatting
- [ ] User preference for relative vs absolute time
- [x] Handle timezone correctly
- [ ] Update relative times periodically (signal or interval)

*Note: Time formatting lives in `lib/i18n.ts`*

---

### 0.9 Global Signals Setup ✅

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
- [x] All signals defined with proper types
- [x] Computed signals for derived state
- [x] Settings signals sync with localStorage
- [x] Auth signals sync with gateway client

---

### 0.10 Error Handling Infrastructure ✅

**Toast system:**
- [x] `showToast(message, type, duration?)` function
- [x] Toast queue management (max visible, auto-dismiss)
- [x] Toast types: success, error, warning, info
- [x] Accessible announcements (aria-live)

**Error boundary:**
- [x] Create ErrorBoundary component
- [x] Fallback UI with retry option
- [x] Error logging/reporting hook

**Inline error component:**
- [x] Inline error display in login/chat views
- [x] InlineError component with retry button

**Checklist:**
- [x] Toast container positioned correctly (top-right)
- [x] Toasts are keyboard dismissible
- [x] Error boundary catches render errors
- [x] Errors are logged for debugging

---

## Phase 1: Core Features ✅

> All Phase 0 items must be complete before starting Phase 1.

### 1.1 Layout Shell ✅

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
- [x] `<AppShell>` — Main layout container
- [x] `<TopBar>` — Logo, connection status, theme toggle, settings
- [x] `<Sidebar>` — Sessions list, nav sections
- [x] `<MainContent>` — View container with routing

**Sidebar behavior:**
- [x] New Chat button (prominent, top)
- [x] Sessions section (main scrollable area)
  - [x] Session list with active indicator
  - [ ] Search/filter sessions
  - [ ] Grouped by time (Today, Yesterday, etc.) or flat list
- [x] Navigation sections (collapsible, pinned to bottom):
  - [x] **Control**: Overview, Channels, Instances, Sessions, Cron Jobs
  - [x] **Agent**: Skills, Nodes
  - [x] **Settings**: Config, Debug, Logs
  - [x] **Resources**: Docs (external link)
- [x] Centralized navigation config (`src/lib/navigation.tsx`)
- [x] Click section → navigates to that view

**TopBar behavior:**
- [x] Logo/branding (links to chat)
- [x] Gateway health indicator (connected/disconnected, latency)
- [x] Theme toggle (light/dark/system)
- [ ] Settings gear (opens settings modal)

**Responsive behavior:**
- [x] Desktop (>1024px): Sidebar always visible
- [x] Tablet (768-1024px): Sidebar collapsible
- [x] Mobile (<768px): Sidebar as drawer, hamburger menu

---

### 1.2 Gateway Auth ✅

**Login view (`views/Login.tsx`):**
- [x] Gateway URL input
- [x] Auth mode toggle (password vs token)
- [x] Password input (when password mode)
- [x] Token input (when token mode)
- [x] "Remember me" checkbox
- [x] Connect button with loading state
- [x] Error display (invalid credentials, connection failed)
- [x] Auto-connect on load if saved credentials

**Auth flow:**
- [x] Validate inputs before connecting
- [x] Show connecting state
- [x] Handle auth errors gracefully
- [x] On success: save to storage, redirect to chat
- [x] On failure: show error, allow retry

**Session persistence:**
- [x] Save gateway URL + auth to localStorage
- [x] Auto-reconnect on page reload
- [x] Clear on logout

**Logout:**
- [x] Disconnect from gateway
- [x] Clear stored credentials (optional based on "remember me")
- [x] Redirect to login

---

### 1.3 Chat Interface ✅

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
- [x] Auto-resize textarea
- [x] Send with Enter (Shift+Enter for newline)
- [x] Cmd/Ctrl+Enter always sends
- [x] Disabled while sending/streaming
- [ ] Character count (optional)

**Message list behavior:**
- [x] Auto-scroll to bottom on new messages
- [x] Scroll-to-bottom button when scrolled up
- [x] Smooth scrolling
- [x] Loading state for history fetch

**Streaming behavior:**
- [x] Chunks append to current message
- [x] Tool events update tool calls in message
- [x] Typing indicator while streaming
- [x] On complete: message is already in final form

**Tool call visualization:**
- [x] Compact summary: icon + "read src/app.tsx" + duration
- [x] Click to expand details
- [ ] File reads: show file content (scrollable, syntax highlighted)
- [ ] File edits: show diff view
- [x] Errors: show error message with red styling

**Markdown rendering:**
- [x] GFM (tables, strikethrough, autolinks)
- [ ] Admonitions (NOTE, WARNING, TIP, etc.)
- [x] Code blocks with syntax highlighting
- [x] Copy button on code blocks
- [ ] Rendered vs raw toggle

**Error handling:**
- [ ] Failed send: inline error with retry button
- [ ] Connection lost: show banner, queue messages
- [ ] On reconnect: resend queued messages

---

### 1.4 Component Library ✅

**UI Primitives (`components/ui/`):**

| Component | Status | Notes |
|-----------|--------|-------|
| `Button` | ✅ | Primary, secondary, ghost, danger variants; loading state |
| `IconButton` | ✅ | Accessible icon-only button with tooltip |
| `Input` | ✅ | With error state, left/right elements, extends native props |
| `Select` | ✅ | Options array, placeholder, extends native props |
| `Toggle` | ✅ | iOS-style switch with label/description |
| `Checkbox` | ✅ | Traditional checkbox with label |
| `Card` | ✅ | Surface container with title/subtitle/padding variants |
| `FormField` | ✅ | Label + input + error wrapper |
| `Modal` | ✅ | Focus trap, escape to close |
| `Toast` | ✅ | Success, error, warning, info with auto-dismiss |
| `ToastContainer` | ✅ | Manages toast stack |
| `Badge` | ✅ | Status badges with dot indicator |
| `Spinner` | ✅ | Accessible loading spinner |
| `Skeleton` | ✅ | Loading placeholder |
| `ErrorBoundary` | ✅ | Catches render errors with fallback UI |

**Usage:**
- All views use components from `@/components/ui`
- No raw HTML form elements in views
- Consistent styling via CSS variables

---

### 1.5 Navigation System ✅

**Centralized config (`src/lib/navigation.tsx`):**
```tsx
export const navigation: NavSection[] = [
  {
    titleKey: "nav.sections.control",
    items: [
      { id: "overview", labelKey: "nav.overview", icon: OverviewIcon, requiresConnection: true },
      // ...
    ],
  },
  // ...
];
```

**Features:**
- [x] Single source of truth for all pages
- [x] Define pages with: id, label (i18n key), icon, section
- [x] `requiresConnection` flag hides items when disconnected
- [x] `external` flag for links that open in new tab
- [x] `ViewId` type derived from config automatically
- [x] Sidebar renders from config (no manual NavItem entries)
- [x] Collapsible sections pinned to bottom
- [x] Sessions list takes main scrollable area

**To add a new page:**
1. Add icon component to `navigation.tsx`
2. Add item to appropriate section
3. Add i18n key to `locales/en.json`
4. Create view component in `views/`
5. Add case to router in `app.tsx`

---

### 1.6 Additional Infrastructure ✅

**Identity Signals (`src/signals/identity.ts`):**
- [x] Assistant identity (name, avatar, agentId) from gateway
- [x] User identity (name, avatar) from settings
- [x] `loadAssistantIdentity()` fetches from gateway
- [x] Reset to defaults on logout

**Message Caching (`src/signals/chat.ts`):**
- [x] Cache messages to localStorage (`cove:messages-cache`)
- [x] Track cached session key (`cove:messages-session`)
- [x] Restore messages on page reload (same session)
- [x] `saveCachedMessages()` called after history load

**Session Caching (`src/signals/sessions.ts`):**
- [x] Cache sessions list to localStorage (`cove:sessions-cache`)
- [x] Restore on page load for instant sidebar

**Logger (`src/lib/logger.ts`):**
- [x] Namespaced logging (gateway, chat, ui, auth)
- [x] Consistent prefix formatting
- [x] Debug/info/warn/error levels

**Streaming Utilities (`src/lib/streaming.ts`):**
- [x] `mergeDeltaText()` — handles text block merging during streaming
- [x] Tracks `lastBlockStart` for proper delta insertion

**Constants (`src/lib/constants.ts`):**
- [x] Centralized timing constants (cleanup delays, thresholds)
- [x] Default history limit

---

## Phase 2: Session & History

> **Note on Sessions views:**
> - 2.1 = Sidebar quick-access session list (always visible, lightweight)
> - 3.4 = Dedicated Sessions admin view (bulk actions, advanced filters, stats)

### 2.0 Chat Reliability (Phase 1.3 completion) ✅

> Complete the error recovery features that were incomplete in Phase 1.3.

- [x] Failed send → inline error with retry button (`UserMessage.tsx`)
- [x] Connection lost → banner notification (`ConnectionBanner.tsx`)
- [x] Message queuing while disconnected (`messageQueue` in signals/chat.ts)
- [x] Auto-resend queued messages on reconnect (`processMessageQueue` in lib/chat.ts)
- [x] Message status tracking (sending/sent/failed state in Message type)
- [x] Visual indicator for pending/queued messages in UI (`UserMessage.tsx` - clock/dots/error icons + status text)

### 2.1 Session Management ✅

> Sidebar session list with quick actions.

- [x] Fetch session list from gateway (`sessions.list`)
- [x] Session metadata display (agent name, last active)
- [x] Active session indicator
- [x] Click to switch sessions
- [x] Session rename/label (modal)
- [x] Delete session (with confirmation modal)
- [x] Main session pinned to top with pin icon
- [x] Filter by kind (dropdown: All/Main/Isolated/Channel)
- [x] **Hide cron sessions by default** — toggle to show cron sessions
- [x] **Search box** — filter sessions by name/channel/model
- [x] **Group by time** — Today, Yesterday, This Week, Older
- [x] **Session metadata** — show channel badge & token count
- [x] **Model picker polish** — i18n strings, semantic HTML fix

**Not implemented (low priority):**
- Archive session (hide from main list, show in admin view) — needs backend support
- Session status card (expandable usage/cost) — deferred to Phase 4

### 2.2 Session History

> Load and navigate message history within a session.

- [x] Load message history on session switch
- [ ] ~~Infinite scroll / pagination~~ — **Blocked**: Gateway `chat.history` only supports `limit`, not `offset`. Would need upstream change.
- [x] Loading state while fetching history
- [x] Jump to bottom button (when scrolled up)
- [x] Search within current session (client-side filter)
- [x] Filter by date range (client-side filter)
- [x] Highlight search matches in messages

### 2.3 Chat Enhancements

> Message-level actions and media support.

- [x] Message actions menu (hover kebab menu)
  - [x] Copy message (formatted text)
  - [x] Copy message (raw markdown)
  - [x] Retry failed message (inline button, already existed)
- [x] Copy code blocks individually
- [x] File upload (click or drag-drop)
- [x] Image paste from clipboard
- [x] Upload progress indicator (spinner while processing)
- [x] Image/media preview in messages
- [x] Heartbeat message UX
  - [x] Detect heartbeat prompt + HEARTBEAT_OK responses
  - [x] Collapsed/muted styling (expandable on click)
  - [x] Group consecutive heartbeats into single collapsible block
- [x] Compaction event UX
  - [x] Detect compaction summary messages in history
  - [x] Visual indicator for "conversation was compacted here"
  - [x] Collapsed/expandable view of compaction summary

### 2.4 Settings View

> Full settings page accessible via cog icon in TopBar.

**Navigation:**
- [x] Add Settings to nav config (settings section)
- [ ] Cog icon in TopBar navigates to Settings view
- [ ] Settings view with sectioned layout

**Appearance Section:**
- [ ] Theme picker (already have ThemePicker component)
- [ ] Font size (sm, md, lg) with live preview
- [ ] Font family (Geist, Inter, System, JetBrains Mono, OpenDyslexic)

**Preferences Section:**
- [ ] Time display (relative vs absolute)
- [ ] Date format preference

**Notifications Section:**
- [ ] Enable/disable browser notifications
- [ ] Sound toggle

**Help Section:**
- [ ] Keyboard shortcuts reference
- [ ] Links (docs, GitHub, Discord)

**About Section:**
- [ ] Cove version
- [ ] Gateway info (version, URL)
- [ ] OpenClaw links

**Actions:**
- [ ] Reset to defaults button

### 2.5 Onboarding

> First-time user experience. (Could defer to Phase 4 polish.)

- [ ] First-run detection (no saved gateway URL)
- [ ] Welcome modal with quick overview
- [ ] Connection setup wizard
  - [ ] Gateway URL input with validation
  - [ ] Auth method selection (password vs token)
  - [ ] Test connection before saving
  - [ ] Error messages with troubleshooting hints
- [ ] Skip option for returning users / manual setup
- [ ] Connection troubleshooting guide (common errors, fixes)

---

## Phase 3: Operations

### 3.1 Overview Dashboard
- [ ] Gateway connection panel (URL, token/password, connect/disconnect)
- [ ] Gateway health (uptime, version, tick interval)
- [ ] Quick stats (sessions count, cron next run, presence count)
- [ ] Auth hints for connection failures
- [ ] Secure context warnings (HTTP vs HTTPS)

### 3.2 Channels View
- [ ] Grid of channel cards (WhatsApp, Telegram, Discord, Signal, Slack, GoogleChat, iMessage, Nostr)
- [ ] Per-channel status (connected, error, disabled)
- [ ] Per-channel config section (expandable)
- [ ] Channel health summary
- [ ] Account count per channel
- [ ] Enable/disable toggles
- [ ] Channel-specific actions (QR login for WhatsApp, etc.)

### 3.3 Instances View
- [ ] List connected clients/services (presence beacons)
- [ ] Instance metadata (mode, roles, scopes, last input)
- [ ] Refresh button
- [ ] Presence age display

### 3.4 Sessions View
- [ ] List all sessions with filters (active minutes, limit)
- [ ] Session metadata (model, channel, created, last active, tokens)
- [ ] Patch session (label, thinking level, verbose level, reasoning level)
- [ ] Delete session
- [ ] Include/exclude global sessions toggle
- [ ] Include/exclude unknown sessions toggle
- [ ] Click to switch active session

### 3.5 Cron Job Management
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

### 3.6 Skills Browser
- [ ] List bundled, managed, and workspace skills
- [ ] Search/filter skills
- [ ] View skill description & location
- [ ] View SKILL.md contents
- [ ] Enable/disable toggle per skill
- [ ] Install from ClawdHub

### 3.7 Nodes Management
- [ ] List paired nodes (mobile devices)
- [ ] Node status (online/offline, last seen)
- [ ] Send notification
- [ ] Trigger camera snap (front/back/both)
- [ ] Request location
- [ ] Screen recording controls
- [ ] Approve/reject pending pairing requests

### 3.8 Configuration Editor
- [ ] View current config (formatted JSON)
- [ ] Schema-aware form UI (like OpenClaw default)
- [ ] Edit with syntax highlighting (raw mode)
- [ ] Diff view before applying
- [ ] Apply config (with restart)
- [ ] Config backup before changes

### 3.9 Debug View
- [ ] Raw snapshots display (status, health, heartbeat JSON)
- [ ] Security audit summary
- [ ] Manual RPC tester (method + params → result)
- [ ] Event log viewer (live stream of gateway events)

### 3.10 Logs Viewer
- [ ] Gateway JSONL log viewer
- [ ] Level filters (trace, debug, info, warn, error, fatal)
- [ ] Text search filter
- [ ] Auto-follow toggle (tail mode)
- [ ] Export filtered logs
- [ ] Truncation indicator for large logs

### 3.11 Docs Link
- [ ] Nav item linking to https://docs.openclaw.ai
- [ ] Opens in new tab

---

## Phase 4: Nice to Have

### 4.1 Memory Browser
- [ ] Tree view of MEMORY.md + memory/*.md
- [ ] View file contents
- [ ] Edit in-place
- [ ] Search across memory files
- [ ] Git history view (if repo)

### 4.2 Global Search
- [ ] Search across all sessions
- [ ] Search results with session context
- [ ] Jump to message in session
- [ ] Search filters (date range, session kind, model)

### 4.3 Conversation Export
- [ ] Export single session: JSON
- [ ] Export single session: Markdown
- [ ] Export single session: PDF (complex)
- [ ] Bulk export multiple sessions
- [ ] Include/exclude tool calls in export

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

### 4.6 Provider Usage Limits (Enhancements)

> Extends Phase 2.2 (Anthropic Usage Tracker)

**Warning System:**
- [ ] Toast notification when usage exceeds 80%
- [ ] Toast notification when usage exceeds 90% (more urgent)
- [ ] Configurable warning thresholds
- [ ] "Don't show again" option per threshold

**Additional Providers:**

| Provider | API | Limits Tracked | Priority |
|----------|-----|----------------|----------|
| Anthropic | ✅ Done | 5h, Weekly, Model-specific | — |
| GitHub Copilot | `github-copilot` | Premium interactions, Chat quota | High |
| OpenAI Codex/ChatGPT | `openai-codex` | Primary/secondary windows, Credits | High |
| Google Gemini CLI | `google-gemini-cli` | Model-specific quotas | Medium |
| Google Antigravity | `google-antigravity` | Monthly credits, Model quotas | Medium |
| z.ai | `zai` | Plan limits with reset times | Low |
| MiniMax | `minimax` | Various usage windows | Low |
| Xiaomi | `xiaomi` | TBD | Low |

**UI Enhancements:**
- [ ] Multi-provider support in UsageBadge (tabs or stacked)
- [ ] Provider icon/logo in badge
- [ ] Collapsed view shows worst usage across providers
- [ ] Settings to show/hide specific providers
- [ ] Historical usage graph (sparkline in popover)

### 4.7 Multi-Session View
- [ ] Split pane layout
- [ ] Monitor multiple sessions
- [ ] Drag/drop session arrangement

### 4.8 Browser Automation Viewer
- [ ] View snapshots from browser tool
- [ ] Screenshot gallery
- [ ] Interactive element highlighting

### 4.9 Sub-Agent Spawner
- [ ] UI to spawn background tasks
- [ ] Select agent, model, task
- [ ] Monitor progress
- [ ] View results when complete

### 4.10 UX Polish
- [ ] Dark/light theme toggle
- [ ] Mobile responsive
- [ ] Keyboard shortcuts (global navigation)
- [ ] Customizable layout
- [ ] Notifications (desktop/browser)

### 4.11 PWA Support
- [ ] manifest.json (app name, icons, theme colors, display mode)
- [ ] Service worker for install prompt
- [ ] Offline caching (optional)
- [ ] iOS/Android home screen install support

### 4.12 Custom Theming
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
