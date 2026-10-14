# Ingest connectors (KB sources)

Connectors push or pull **text** into a knowledge base’s document + processing pipeline. Manage them in the console: **Documents → Connectors**, or via `/api/kbs/{kb_id}/sources`.

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
- **Schedule:** set `poll_interval_minutes` in `config` and enable server tick:

```bash
SEMA_HTTP_POLL_TICK_SECONDS=60
```

Optional `config` keys (UI or API):

- `title` — document title on each sync
- `external_key_prefix` — prefix for auto-generated `doc_id` (`prefix-random`)

Git `config`: `repo_url` (GitHub HTTPS), `branch`, `paths[]`.

## Platform API tokens vs ingest tokens

| Token | API | Purpose |
| --- | --- | --- |
| **Platform API token** | `/api/tokens`, UI **Account → API tokens** | User Bearer; scoped `kb_ids`; graph/read APIs, MCP |
| **Ingest token** | Created with webhook source | Only that source’s webhook endpoint |

## Sync history

`config.sync_events` records recent runs (`succeeded` / `failed`, `error` when applicable).

## Tests

`pytest tests/test_kb_sources.py`
