# Cove Design Philosophy

## Core Principles

### 1. Scalability First
Design for the power user with 100 items, not just the demo with 5. Tables over card grids for dense data. Pagination or virtual scrolling when needed. Test with realistic data volumes.

### 2. Progressive Disclosure
Show only what's needed at each level:
- **List view**: Enough to identify and act (name, status, key metadata)
- **Detail view**: Full configuration and advanced options
- **Modals**: For focused tasks that need confirmation

Don't overwhelm with options. Hide complexity until it's needed.

### 3. Visual Hierarchy Through Iconography
Icons should do double duty:
- Convey type/status at a glance (colored icons for session types, status dots)
- Replace text labels where unambiguous (remove redundant columns)
- Use consistent color coding: green=success/main, blue=info/channel, amber=warning/cron, red=error/danger

### 4. Filters That Feel Natural
Prefer clickable elements over hidden dropdowns:
- Stat cards that double as filters
- Tabs for mutually exclusive views
- Search in the header, always visible when relevant

Users should discover filtering by exploring, not by hunting.

### 5. Actions Where You Need Them
- **Inline actions**: Quick edits (rename) shouldn't require modals
- **Row actions**: Common operations (delete, open) visible on hover or always
- **Bulk actions**: When selecting multiple items, show contextual toolbar
- **Modal actions**: For destructive or multi-step operations that need confirmation

### 6. Consistent Component Language
Reuse the same patterns everywhere:
- `max-w-5xl mx-auto` for page containers
- `space-y-6` for section spacing
- `Card` component for grouped content
- `Badge` for status indicators
- `IconButton` for compact actions
- Same border radius (`rounded-xl`), shadows (`shadow-soft`), transitions

### 7. Respect the Space
- Fixed widths for predictable data (dates, numbers, status)
- Flexible widths for variable data (names, descriptions)
- `whitespace-nowrap` to prevent awkward wrapping
- `truncate` with `title` attribute for overflow
- No wasted whitespace, but breathing room between sections

### 8. Responsive by Default
- Mobile-first grid breakpoints (`grid-cols-2 md:grid-cols-5`)
- Collapsible sidebars for narrow viewports
- Touch-friendly tap targets (min 44px)
- Horizontal scroll for tables on mobile rather than hiding columns

### 9. Accessible Always
- Keyboard navigation for all interactive elements
- `aria-label` on icon-only buttons
- Focus rings visible and consistent
- Color not the only indicator (icons + color, not just color)
- Screen reader friendly table structure

### 10. Feedback and State
- Loading spinners with optional labels
- Empty states with helpful messaging and actions
- Error states that explain what went wrong
- Success feedback (toast, animation, or state change)
- Optimistic UI where safe, with rollback on failure

---

## Component Patterns

### Page Layout
```tsx
<div class="flex-1 overflow-y-auto p-6">
  <div class="max-w-5xl mx-auto space-y-6">
    {/* Header */}
    {/* Content */}
  </div>
</div>
```

### Stat Cards (Clickable Filters)
Use for counts that double as filters. Active state shows border highlight.

### Tables
- Header row with `border-b`, muted text, `font-medium`
- Body rows with `hover:bg-[var(--color-bg-hover)]`, `cursor-pointer` if clickable
- Always-visible actions in last column
- `whitespace-nowrap` for dates/numbers

### Modals
- Use for focused tasks, confirmations, or detail editing
- Footer has cancel (left or right) and primary action (right)
- Destructive actions on left side of footer
- `size="xl"` for forms with multiple fields

### Dropdowns
- Use `position: fixed` for menus to escape overflow containers
- Consistent keyboard navigation (arrow keys, enter, escape)

---

## Color Usage

| Purpose | CSS Variable | When to Use |
|---------|--------------|-------------|
| Success/Main | `--color-success` | Main sessions, connected status, confirmations |
| Info/Channel | `--color-info` | Channel sessions, informational badges |
| Warning/Cron | `--color-warning` | Cron sessions, caution states |
| Error/Danger | `--color-error` | Delete actions, errors, disconnected |
| Accent | `--color-accent` | Primary actions, active filters, focus rings |
| Muted | `--color-text-muted` | Secondary text, icons, timestamps |

---

## Don'ts

- ❌ Don't use card grids for lists that might grow large
- ❌ Don't hide essential actions behind hover-only states on touch devices
- ❌ Don't use color alone to convey meaning
- ❌ Don't truncate without a `title` tooltip
- ❌ Don't put dropdowns in scrollable containers without fixed positioning
- ❌ Don't create new components when existing UI primitives work
- ❌ Don't inline styles when CSS variables exist
- ❌ Don't skip i18n for any user-facing string
