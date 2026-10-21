# Workspace frame (`lib/workspace/`)

React catalog + capability providers for `/workspaces/:id/*` routes.

| File | Role |
| --- | --- |
| `context.tsx` | Workspace catalog (`WorkspaceCatalogProvider`, `useWorkspaceCatalog`) |
| `capabilities.tsx` | Feature flags / nav gating |
| `active-id.ts` | Active workspace id (localStorage, setup id, sidebar resolve) |

HTTP, WebSocket, API paths, node labels: [`lib/explorer/`](../explorer/README.md).

Segment-specific helpers: `modules/<segment>/lib/` — see [`lib/README.md`](../README.md).
