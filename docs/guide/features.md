# Features

Cove is packed with features for both chatting and managing your OpenClaw gateway.

## Chat

### Real-time Streaming
Watch responses flow in with live markdown rendering. No waiting for the full response — see tokens appear as they're generated.

### Tool Call Visualization
See what your assistant is doing with expandable tool details. Each tool call shows the input, output, and execution time.

### Syntax Highlighting
Beautiful code blocks with automatic language detection and one-click copy. Supports 50+ languages.

### File Upload
Drag & drop or paste images directly into chat. Images are automatically resized and sent to your assistant.

### Message Search
Find anything with text search and date filters. Search across all sessions or within a single conversation.

### Session Management
Create, rename, delete, and organize conversations. Each session maintains its own context and history.

### Command Palette
Press `⌘K` (Mac) or `Ctrl+K` (Windows/Linux) to access any action instantly. Search commands, switch sessions, change settings — all without leaving the keyboard.

## Operations Dashboard

Cove isn't just a chat interface — it's a full operations dashboard for your OpenClaw gateway.

### Cron Jobs
Create and manage scheduled tasks with visual editors. Set up recurring jobs, one-time tasks, and monitor execution history.

### Config Editor
Edit your gateway configuration with:
- Schema validation
- Diff view to see changes
- Syntax highlighting
- Auto-save

### Sessions Admin
View all sessions across your gateway:
- Usage statistics per session
- Filter by type, age, or activity
- Bulk actions (delete, export)
- Session details and history

### Channels
Monitor all messaging channels:
- Telegram, Discord, Signal, Slack, and more
- Connection status
- Message stats
- Quick actions

### Skills Browser
Browse and manage assistant skills:
- View installed skills
- Search [ClawHub](https://clawhub.ai) for new skills
- One-click install
- Skill documentation

### Devices
Manage paired devices:
- Approve pairing requests
- Revoke access
- View device details
- Canvas-enabled devices

### Logs
Real-time log viewer:
- Level filtering (debug, info, warn, error)
- Text search
- Live tailing
- Export logs

### Workspace
Browse and edit agent configuration files:
- YAML/JSON editing
- Token counts for each file
- Quick navigation
- Memory file browser

### Usage Analytics
Per-session analytics:
- Token usage timeline
- Cost breakdown by model
- Daily/weekly/monthly views
- Export data

## Customization

### Themes
Choose from 12 beautiful themes:

| Light | Dark |
|-------|------|
| Light | Dark |
| Nord Light | Nord |
| Catppuccin Latte | Catppuccin Mocha |
| Rosé Pine Dawn | Rosé Pine |
| | Dracula |
| | Tokyo Night |
| | Gruvbox |
| | Ayu |

### System Sync
Automatically switch between light and dark themes based on your OS preference.

### Font Options
Choose the font that works best for you:
- **System** — Your OS default
- **Geist** — Modern and clean
- **Inter** — Highly readable
- **JetBrains Mono** — Great for code
- **OpenDyslexic** — Improved readability

### Text Size
Adjust text size to your preference: Small, Medium, or Large.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘K` / `Ctrl+K` | Open command palette |
| `⌘Enter` / `Ctrl+Enter` | Send message |
| `Shift+Enter` | New line in message |
| `Escape` | Close modal/panel |
| `⌘Shift+C` / `Ctrl+Shift+C` | Toggle canvas panel |
| `⌘,` / `Ctrl+,` | Open settings |

## Security

### Exec Approval
When your assistant wants to run shell commands, Cove shows an interactive modal. Review the command, see what it does, then approve or deny.

### Secure Storage
Credentials are stored in your browser's localStorage. Nothing is sent to external servers.

### No Telemetry
Cove collects no analytics or telemetry. Your data stays between your browser and your gateway.

## Canvas

The canvas feature lets your assistant push content directly to your browser:

- **Images** — View generated images, charts, diagrams
- **HTML** — Interactive content, forms, animations
- **Web pages** — Load any URL in an embedded frame

The canvas appears as a floating panel that can be:
- Dragged anywhere
- Docked to the left, right, or top
- Popped out to a separate window
- Minimized when not needed

See [Canvas Setup](/canvas/) for configuration details.
