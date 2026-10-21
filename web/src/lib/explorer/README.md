# Explorer client (`lib/explorer/`)

Scoped HTTP and graph runtime for `/workspaces/:id/*` routes.

| Export | Role |
| --- | --- |
| `WorkspaceHostProvider`, `WorkspaceHttpConfig` | Mount per-workspace API root + auth |
| `workspaceFetch`, `workspaceFetchJson` | Authenticated fetch under workspace API |
| `buildWorkspaceApiPath`, `buildWorkspaceGraphApiPath` | Path builders |
| `graphStore`, `graphTheme`, … | Graph canvas client state |

| `api-path`, `ws-host`, `ws-client`, `ws-context`, `node-labels` | API root helpers, HTTP config, WS client shell, label resolution |

Configure workspace routes with `buildWorkspaceHttpConfig` in `ws-host.ts`.
