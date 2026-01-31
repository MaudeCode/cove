# Chat UI Redesign Plan

## Design Decisions

| Decision | Choice |
|----------|--------|
| Assistant identity | Fetch via `agent.identity.get` API |
| Assistant icon | Configurable, default from API avatar |
| User identity | From gateway/session, configurable icon |
| Message width | Max-width for readability (~768px) |
| Tool calls | Inline, grouped as they happen |
| User message color | Muted accent |
| Reference style | Clean, modern AI assistant (not iMessage) |

---

## Implementation Steps

### Step 1: Layout Structure ✅ → 🔄
- [ ] Remove left/right bubble alignment
- [ ] Single column, left-aligned messages
- [ ] Max-width container (768px) centered
- [ ] More vertical spacing between messages

### Step 2: Message Components
- [ ] Create `AssistantMessage` component
  - [ ] Avatar/icon on left
  - [ ] Name header ("Maude" etc.)
  - [ ] Full-width content area
  - [ ] Tool calls inline
- [ ] Create `UserMessage` component
  - [ ] Subtle background (muted accent)
  - [ ] User icon/initial on left
  - [ ] "You" or user name header
- [ ] Update `SystemMessage` styling
  - [ ] Full-width banner, muted
  - [ ] Info icon

### Step 3: Identity Integration
- [ ] Add `agent.identity.get` API call
- [ ] Create identity signals (assistantName, assistantAvatar)
- [ ] Load identity on connect
- [ ] Display in message headers

### Step 4: Tool Calls Inline
- [ ] Move tool calls from bottom to inline
- [ ] Show as expandable cards during message
- [ ] Icon + name + duration summary
- [ ] Expand for params/result

### Step 5: Typography & Polish
- [ ] Increase line-height
- [ ] Better code block styling (full-width, language label)
- [ ] Refined timestamp display (smaller, muted)
- [ ] Message hover actions (copy)

### Step 6: Streaming Improvements
- [ ] Blinking cursor while streaming
- [ ] Smooth content updates
- [ ] "Thinking..." indicator with avatar

---

## File Changes

| File | Changes |
|------|---------|
| `components/chat/ChatMessage.tsx` | Replace with role-based components |
| `components/chat/AssistantMessage.tsx` | New component |
| `components/chat/UserMessage.tsx` | New component |
| `components/chat/MessageList.tsx` | Update layout, remove bubble logic |
| `signals/identity.ts` | New - assistant/user identity |
| `lib/identity.ts` | API calls for identity |
| `styles/chat.css` | New styles for AI chat layout |

---

## Visual Reference

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🐄 Maude                                     2:34 PM │   │
│  │                                                      │   │
│  │ Here's the code you asked for:                       │   │
│  │                                                      │   │
│  │ ┌──────────────────────────────────────────────────┐ │   │
│  │ │ typescript                              [Copy]   │ │   │
│  │ │ function hello() {                               │ │   │
│  │ │   console.log("Hello!");                         │ │   │
│  │ │ }                                                │ │   │
│  │ └──────────────────────────────────────────────────┘ │   │
│  │                                                      │   │
│  │ ┌─ 📁 Read file.ts ─────────────── 120ms ─────────┐ │   │
│  │ └─────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 👤 You                                       2:35 PM │   │
│  │                                                      │   │
│  │ Thanks! Can you also add error handling?             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Notes

- Keep existing `ChatMessage.tsx` during transition, rename to `ChatMessageLegacy.tsx`
- Tool calls need to work both inline (during stream) and final (from history)
- Avatar can be emoji, URL, or single letter
- Consider animation for tool call expand/collapse
