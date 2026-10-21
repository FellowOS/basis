# Explorer client (`lib/explorer/`)

Scoped HTTP and graph runtime for `/workspaces/:id/*` routes.

| Export | Role |
| --- | --- |
| `WorkspaceHostProvider`, `WorkspaceHttpConfig` | Mount per-workspace API root + auth |
| `workspaceFetch`, `workspaceFetchJson` | Authenticated fetch under workspace API |
| `buildWorkspaceApiPath`, `buildWorkspaceGraphApiPath` | Path builders |
| `graphStore`, `graphTheme`, … | Graph canvas client state |

Configure via `buildWorkspaceHttpConfig` in `lib/workspace/ws-host.ts`.
