# Workspace frame (`app/shared/workspace/`)

Per-workspace **console chrome** (switcher, shells, unavailable states) and small shared ledger primitives.

| Path | Import |
| --- | --- |
| `frame/` | `@/components/app/shared/workspace/frame/` |
| `entity-ref-line.tsx` | `@/components/app/shared/workspace/entity-ref-line.js` |

HTTP/WebSocket client: `@/lib/explorer/ws-http.js`. Workspace helpers: `@/lib/workspace/`.

Shell roots use the `basis-ws-console` CSS hook (and segment classes like `basis-graph-canvas`) plus `data-workspace-id` for E2E targeting.
