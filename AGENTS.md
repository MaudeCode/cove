# AGENTS.md - Cove Development Guidelines

**This file is mandatory reading for any LLM or agent working on this codebase.**
**Violations of these guidelines will result in rejected PRs.**

---

## Project Overview

Cove is a full-featured WebUI for OpenClaw. Read `ROADMAP.md` for feature specifications.

---

## Tech Stack (Non-Negotiable)

| Technology | Package | Notes |
|------------|---------|-------|
| Framework | Preact | NOT React. Use `preact` imports. |
| State | @preact/signals | Signals for reactivity. NOT useState for global state. |
| Styling | Tailwind CSS | Utility-first. Use CSS variables for theming. |
| Routing | preact-router | Official Preact router. |
| Icons | lucide-preact | Tree-shakeable icons. |
| Markdown | markdown-it | With GFM and admonition plugins. |
| Syntax Highlighting | Prism | Lightweight, themeable. |
| Package Manager | Bun | NOT npm or yarn. Use `bun install`, `bun run`. |

---

## Project Structure (Enforced)

```
src/
├── components/
│   ├── ui/           # Reusable primitives (Button, Input, Modal, Toast, etc.)
│   └── chat/         # Chat-specific components (Message, ToolCall, etc.)
├── views/            # Full page views (Chat, Cron, Config, Status)
├── lib/              # Utilities and services
│   ├── gateway.ts    # WebSocket client for OpenClaw gateway
│   ├── storage.ts    # localStorage wrapper
│   ├── i18n.ts       # Localization utilities
│   └── ...
├── hooks/            # Custom Preact hooks (when needed)
├── signals/          # Global state (Preact signals)
├── styles/           # Global CSS, Tailwind config, fonts
└── types/            # TypeScript type definitions
```

**Rules:**
- Components go in `components/`. No components in `views/` or `lib/`.
- Views are full pages only. They compose components.
- Shared logic goes in `lib/`. Keep it pure and testable.
- Types go in `types/`. Co-located types are acceptable for component-specific types.

---

## Code Style (Enforced)

### Imports

**DO:**
```tsx
// Individual icon imports (tree-shaking)
import { Menu, Settings, Plus } from 'lucide-preact'

// Named imports from lib
import { connectGateway } from '@/lib/gateway'
```

**DON'T:**
```tsx
// NO barrel imports that pull everything
import * as Icons from 'lucide-preact'

// NO default imports when named exist
import gateway from '@/lib/gateway'
```

### Components

**DO:**
```tsx
// Functional components with explicit types
interface ButtonProps {
  label: string
  onClick: () => void
  disabled?: boolean
}

export function Button({ label, onClick, disabled = false }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      class="px-4 py-2 rounded bg-primary text-white"
    >
      {label}
    </button>
  )
}
```

**DON'T:**
```tsx
// NO React.FC or FC types
const Button: FC<Props> = ...

// NO class components
class Button extends Component ...

// NO inline styles
<button style={{ padding: '16px' }}>

// NO className (Preact uses class)
<button className="...">
```

### State Management

**DO:**
```tsx
// Signals for reactive state
import { signal, computed } from '@preact/signals'

export const sessions = signal<Session[]>([])
export const activeSession = computed(() => 
  sessions.value.find(s => s.active)
)
```

**DON'T:**
```tsx
// NO useState for global/shared state
const [sessions, setSessions] = useState([])

// NO prop drilling for global state
<Parent sessions={sessions}>
  <Child sessions={sessions}>
```

### Tailwind

**DO:**
```tsx
// Use Tailwind utilities
<div class="flex items-center gap-4 p-4 bg-surface rounded-lg">

// Use CSS variables for theming
<div class="bg-[var(--color-surface)] text-[var(--color-text)]">
```

**DON'T:**
```tsx
// NO arbitrary values when Tailwind class exists
<div class="p-[16px]">  // Use p-4

// NO inline styles
<div style={{ display: 'flex' }}>
```

---

## Accessibility (Mandatory)

Every interactive element MUST have:

1. **ARIA labels** - All buttons, inputs, and interactive elements
2. **Keyboard support** - Tab navigation, Enter/Space activation
3. **Focus indicators** - Visible focus states
4. **Semantic HTML** - Use `<button>`, `<nav>`, `<main>`, etc.

```tsx
// CORRECT
<button
  aria-label={t('newChat')}
  onClick={handleNewChat}
  class="focus:ring-2 focus:ring-primary"
>
  <Plus aria-hidden="true" />
</button>

// WRONG - No aria-label, icon not hidden
<div onClick={handleNewChat}>
  <Plus />
</div>
```

---

## Internationalization (Mandatory)

All user-facing strings MUST be extracted for translation.

**DO:**
```tsx
import { t } from '@/lib/i18n'

<button aria-label={t('newChat')}>{t('newChat')}</button>
<p>{t('errors.connectionFailed')}</p>
```

**DON'T:**
```tsx
// NO hardcoded user-facing strings
<button>New Chat</button>
<p>Connection failed</p>
```

Exceptions: Log messages, debug output, code/technical content.

---

## Streaming = History (Critical Requirement)

**This is non-negotiable.**

Streaming messages and history messages MUST:
1. Use the **same data structure** (`Message` type)
2. Use the **same component** (`<ChatMessage>`)
3. Look **visually identical** (except typing indicator)
4. Require **no refresh** after streaming ends

```tsx
// ONE component for both
<ChatMessage 
  message={msg} 
  isStreaming={msg.id === currentStreamId} 
/>

// ONE type for both
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCall[]
  timestamp: number
}
```

---

## File Naming

- Components: `PascalCase.tsx` (e.g., `ChatMessage.tsx`)
- Utilities: `camelCase.ts` (e.g., `gateway.ts`)
- Types: `camelCase.ts` or `PascalCase.ts` for main type files
- Views: `PascalCase.tsx` (e.g., `Chat.tsx`, `CronJobs.tsx`)
- Styles: `kebab-case.css` (e.g., `animations.css`)

---

## Commits

Use conventional commits:
- `feat(scope):` - New features
- `fix(scope):` - Bug fixes
- `refactor(scope):` - Code changes that neither fix bugs nor add features
- `style(scope):` - Formatting, missing semicolons, etc.
- `docs(scope):` - Documentation
- `chore(scope):` - Maintenance, dependencies
- `a11y(scope):` - Accessibility improvements
- `i18n(scope):` - Internationalization

---

## Pull Request Checklist

Before submitting a PR, verify:

- [ ] No `import *` statements
- [ ] All icons imported individually from `lucide-preact`
- [ ] All user-facing strings use `t()` for i18n
- [ ] All interactive elements have ARIA labels
- [ ] All interactive elements are keyboard accessible
- [ ] Components are in correct directories per structure
- [ ] Using `class` not `className`
- [ ] Using Tailwind utilities, not inline styles
- [ ] Using signals for shared state, not prop drilling
- [ ] Streaming and history use same Message type/component
- [ ] Bun lockfile updated (not npm/yarn)
- [ ] No React-specific imports (use Preact)

---

## Common Mistakes to Avoid

1. **Importing React** - Use Preact. `import { h } from 'preact'` if needed.
2. **className** - Preact uses `class`.
3. **useState for global state** - Use signals.
4. **Hardcoded strings** - Use i18n.
5. **Missing ARIA** - Every interactive element needs labels.
6. **Barrel imports** - Import specifically what you need.
7. **npm/yarn** - Use Bun.
8. **Different streaming/history rendering** - They must be identical.

---

## Questions?

Read `ROADMAP.md` for feature specifications and priorities.

If unsure about a decision, ask before implementing.
