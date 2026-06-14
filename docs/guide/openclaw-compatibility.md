# OpenClaw Compatibility

Use this checklist before updating the OpenClaw gateway version that Cove targets.

## Gateway Protocol

- Cove connects to the gateway with protocol version 4 only: `minProtocol: 4` and `maxProtocol: 4`.
- The browser client identifies as `openclaw-control-ui` with mode `ui`, role `operator`, and `tool-events` capability.
- The canvas node connection also uses protocol version 4 and keeps the node role, canvas capability, and challenge nonce signature in sync.
- `connect.challenge` may arrive as either `event` or legacy `evt`; both forms should continue to authenticate.

## Regression Checks

Run these before a gateway compatibility bump:

```bash
bun test tests/integration/gateway/mock-websocket.test.ts tests/unit/lib/node-connection.test.ts
bun test tests/unit/signals/sessions.test.ts tests/unit/signals/models.test.ts
bun run typecheck
bun run build
```

The production build should not emit Vite chunk size or dynamic-import warnings.

## Session Events

- `sessions.changed` updates existing cached sessions without requiring a full reload.
- Complete new `sessions.changed` payloads are added to the session cache and then sorted by the normal recency rules.
- Unknown key-only session events trigger a coalesced `sessions.list` refresh instead of creating skeletal cached sessions.
- Delete events remove the matching cached session and clear it if it was active.
- Malformed or keyless session events schedule one coalesced `sessions.list` refresh so Cove can recover from shape drift.

## Model Catalog

- Cove calls `models.list` with `{ "view": "configured" }` so users only see models backed by configured credentials.
- Cove does not fall back to `default` or `all` model catalog views when the configured view is empty.
- The status RPC is used only to derive the default session model; a status failure must not clear the previous default model.
- A successful status response that omits the default model clears stale default model state.
