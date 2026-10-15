# Ingest connectors (KB sources)

中文说明：[ingest-connectors.zh.md](./ingest-connectors.zh.md)

Connectors push or pull **text** into a knowledge base’s document + processing pipeline. In the console: **KB → Sources** → **Ingest sources**, or via `/api/kbs/{kb_id}/sources`.

Deep link (e.g. from a `sync_failed` alert): `/kbs/{kb_id}/sources?connectors=1&ingestSource={source_id}` opens the connectors dialog and highlights that source.

## Types

| Kind | Direction | Auth |
| --- | --- | --- |
| `webhook` | External system POSTs JSON | Bearer ingest token (per source) |
| `http_poll` | Sema GETs a URL | User session / API token for management; URL is public fetch |
| `git` | Sema GETs GitHub raw files | Same as http_poll; public GitHub repos only (MVP) |

## Webhook

1. Create source (`kind: webhook`); save the one-time `ingest_token`.
2. `POST /api/kbs/{kb_id}/sources/{source_id}/webhook` with `Authorization: Bearer <ingest_token>`.

Body fields: `text` (required), `title`, `external_key`, `auto_process` (default true).

## HTTP poll & Git

- **Manual sync:** `POST /api/kbs/{kb_id}/sources/{source_id}/sync`
- **Sync history:** `GET /api/kbs/{kb_id}/sources/{source_id}/sync-history` (newest-first `sync_events` tail)
- **Schedule:** set `poll_interval_minutes` in `config` and enable server tick:

```bash
SEMA_HTTP_POLL_TICK_SECONDS=60
```

Optional `config` keys (UI or API):

- `title` — document title on each sync
- `external_key_prefix` — prefix for auto-generated `doc_id` (`prefix-random`)

Git `config`: `repo_url` (GitHub HTTPS), `branch`, `paths[]`.

## Ingest token vs KB access token

| Token | Where | Purpose |
| --- | --- | --- |
| **Ingest token** | Webhook source (connectors dialog) | Only that source’s `.../webhook` endpoint |
| **KB access token** | **KB → Ask (chat)** MCP panel, `/api/kbs/{id}/tokens` | Bearer for MCP and KB-scoped API; scope `read` or `write` (write required for `propose_remember` / graph mutations) |

## Sync history

`config.sync_events` records recent runs (`succeeded` / `failed`, `error` when applicable). Failed runs also emit a KB **alert** (`sync_failed`) visible in the header bell.

## Limits (MVP)

**Product scope:** only `webhook`, `http_poll`, and GitHub raw `git` — **no additional connector kinds** are planned until explicitly reopened.

| Not supported yet | Notes |
| --- | --- |
| Full `git clone` / private Git hosts | `git` kind fetches **public GitHub raw** paths only |
| Arbitrary OAuth to SaaS | Use `webhook` or `http_poll` for bespoke integrations |
| S3 presign / second connector family | Deferred; use webhook or poll URL |
| Durable sync-run table | History is the tail in `config.sync_events` + `GET .../sync-history` |

## Tests

`pytest tests/test_kb_sources.py`
