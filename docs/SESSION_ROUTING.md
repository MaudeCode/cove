# Session Routing in Cove

## How OpenClaw Sessions Work

OpenClaw uses session keys to route messages to the correct conversation context. The main session key format is:

```
agent:<agentId>:<mainKey>
```

For example: `agent:main:main`

## The Gateway Hello Response

When connecting to the gateway, the `hello-ok` response includes session defaults:

```json
{
  "type": "hello-ok",
  "snapshot": {
    "sessionDefaults": {
      "defaultAgentId": "main",
      "mainKey": "main",
      "mainSessionKey": "agent:main:main"
    }
  }
}
```

**Critical:** The `mainSessionKey` is the actual session key to use for chat operations. Simply passing `"main"` as the session key will NOT work correctly.

## How Cove Handles This

1. **On connect:** We capture `mainSessionKey` from `hello.snapshot.sessionDefaults`
2. **Store in signal:** `mainSessionKey` signal in `lib/gateway.ts`
3. **Resolve at runtime:** `effectiveSessionKey` computed signal in `signals/sessions.ts` resolves `"main"` → actual mainSessionKey
4. **Use for chat:** All `chat.send`, `chat.history`, and `chat.abort` calls use the resolved key

## Key Files

- `src/lib/gateway.ts` — Captures `mainSessionKey` from hello response
- `src/signals/sessions.ts` — `effectiveSessionKey` computed signal
- `src/views/ChatView.tsx` — Uses `effectiveSessionKey` for all operations
- `src/types/gateway.ts` — `HelloPayload` type with `sessionDefaults`

## Common Pitfall

If you pass `sessionKey: "main"` to `chat.send`, the gateway may:
- Create a new separate session
- Route to a different context than expected
- Cause messages to appear in a different conversation

Always use the `mainSessionKey` from the hello response for the default/main session.

## Debugging

Check the browser console after connecting:
```
[gateway] Main session key: agent:main:main
```

If this doesn't appear, the gateway may not be sending session defaults, or there's a connection issue.
