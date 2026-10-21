# Shared `src/lib/`

Cross-cutting client code used by **multiple** workspace modules, shell, admin, or marketing. Feature-specific helpers live under [`modules/<segment>/lib/`](../modules/README.md).

## Keep here

| Area | Path | Role |
| --- | --- | --- |
| OpenAPI transport | `basis-openapi/`, `openapi-client.ts`, `api-v1-path.ts` | Typed HTTP |
| Session | `basis-session-*`, `basis-session-fetch.ts` | Cookies, streaming fetch |
| Workspace frame | `workspace/` | `context`, `capabilities`, `active-id` |
| Explorer client | `explorer/`, `explorer-client.ts` | `ws-http`, `api-path`, `ws-host` / `ws-client` / `ws-context`, `node-labels`, graph store |
| Nav / runtime | `nav-config.ts`, `workspace-nav-label.ts`, `app-runtime.ts`, `basis-runtime.ts` | Routes, env |
| Auth / API errors | `auth-*`, `api-error*.ts`, `api.ts` | Platform |
| UI tokens | `ui-classes/` | Card surfaces, layout classes |
| Misc shared | `utils.ts`, `theme.ts`, `csv.ts`, `basis-api-url.ts`, … | Used across modules |

## Migrated to `modules/*/lib/`

| Module | Files |
| --- | --- |
| `entities` | `entitiesUrlState`, `derived-fact-premise-link` (+ tests) |
| `graph` | `graphUrlState`, graph diff/staging/evidence/parse-export, `temporal/*`, theme sync, `graph-audit-pack`, `use-graph-diff`, `graph-audit` (+ tests) |
| `library` | `sourcesUrlState`, `ingest-upload-limit`, `document-timeline`, `format-byte-size`, `ledger-labels` (+ tests) |
| `processing` | `processingUrlState`, `processing-idempotency`, `processing-options-summary`, `processing-job`, `ingest-ops-hints`, `use-failed-processing-count` (+ tests) |
| `analyze` | `hub-route`, `hub-tabs` (+ tests) |
| `search` | `searchUrlState`, `api-client`, `use-temporal-bounds` (+ tests) |
| `review` | `reviewUrlState` (+ tests) |
| `docs` | `product-docs-*` (+ tests, MDX loader) |
| `admin-audit` | `basis-audit-detail` |
| `admin-connectors` | `platform-connector-allowlist-import` (+ tests) |
| `entity-resolution` | `graph-node-detail` (+ tests) |
| `alerts` | `alert-*`, `alerts-stream`, `alerts-url`, `use-unread-alerts` (+ tests) |
| `connectors` | `connector-oauth`, `connector-mapping-form`, `connector-stream-params`, `connector-connections` (+ tests) |
| `settings` | `graph-projection-labels`, `settings-labels` |
| `integration` | `mcp-labels`, `use-mcp-integration` |

Cross-module URL helpers (e.g. `graphPath`, `reviewDecisionPath`, `workspaceAlertsPath`) are imported via `@/modules/<segment>/lib/…` from other modules, shell, or remaining `lib/workspace/*`.
