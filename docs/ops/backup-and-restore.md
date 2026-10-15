# Backup and restore (Basis data plane)

Canonical state lives in the **admin database** (SQLite file or PostgreSQL), **content blobs** under `BASIS_DATA_DIR`, and **per-KB graph JSON** under the same tree. Graph projections can be **rebuilt** from the ledger after restore; you must not lose the ledger or blobs.

## What to back up

| Asset | Typical path / note |
| --- | --- |
| SQLite DB | `$BASIS_DATA_DIR/basis.db` when `BASIS_DATABASE_URL` is unset |
| PostgreSQL | Logical dump of the Basis database (see below) |
| Blobs | `$BASIS_DATA_DIR/blobs/` (content-addressed) |
| Graph snapshots | `$BASIS_DATA_DIR/graphs/` (optional to backup; rebuildable) |

## Quick backup (SQLite / dev)

```bash
./scripts/backup_basis_data.sh
```

Creates `backups/basis-data-YYYYMMDD-HHMMSS.tar.gz` containing `basis.db`, `blobs/`, and `graphs/`.

## Restore (SQLite)

1. Stop the API process.
2. Extract the archive into `BASIS_DATA_DIR` (or replace the directory).
3. Start the API and sign in with the **same accounts** that existed when the backup was taken (user rows live in `basis.db`).
4. For each KB (or via automation), call `POST /api/kbs/{kb_id}/graph/rebuild` as an **editor** to refresh projections from the ledger. This is required if `graphs/` was omitted from the archive or was deleted after restore.

## PostgreSQL

With `BASIS_DATABASE_URL` set (and `pg_dump` on your PATH):

```bash
./scripts/backup_basis_postgres.sh
```

Writes `backups/basis-pg-YYYYMMDD-HHMMSS.dump` (custom format) plus `basis-blobs-*.tar.gz` when `blobs/` exists. Graph JSON is optional (`basis-graphs-*.tar.gz`); omit graphs and rebuild per KB after restore.

Manual equivalent:

```bash
pg_dump "$BASIS_DATABASE_URL" -Fc -f basis-$(date +%Y%m%d).dump
tar -czf basis-blobs-$(date +%Y%m%d).tar.gz -C "$BASIS_DATA_DIR" blobs
```

### Local Docker (`compose.postgres.yml`)

```bash
docker compose -f compose.postgres.yml up -d
export BASIS_DATABASE_URL=postgresql://basis:basis@127.0.0.1:5432/basis
uv run basis migrate-postgres --database-url "$BASIS_DATABASE_URL"   # first time from SQLite
./scripts/backup_basis_postgres.sh
```

### Restore (PostgreSQL)

1. Stop the API.
2. Create an empty database (or drop/recreate `basis`).
3. Run (destructive):

```bash
BASIS_RESTORE_CONFIRM=yes ./scripts/restore_basis_postgres.sh backups/basis-pg-….dump backups/basis-blobs-….tar.gz
```

Or manually: `pg_restore --clean --if-exists -d "$BASIS_DATABASE_URL" …` and extract blobs into `BASIS_DATA_DIR`.
4. Start the API; `POST /api/kbs/{kb_id}/graph/rebuild` per KB as an editor (unless you restored `graphs/` and trust revision alignment).

Vector indexes after `migrate-postgres` may need a reindex pass per [search-storage-architecture.md](../design/search-storage-architecture.md).

## Related

- Runtime caps and ingest env vars: [runtime-limits.md](./runtime-limits.md)

## Verification

After restore + rebuild:

- Documents list matches expectations (`GET /api/kbs/{id}/documents`).
- `GET /api/kbs/{id}/graph/snapshot` includes expected document nodes.
- Automated checks: `pytest tests/test_release_gate.py`.

## Release gate

PostgreSQL dump/restore scripts are exercised in CI when `BASIS_TEST_POSTGRES_URL` is set (`tests/test_postgres_backup_restore.py`).

See `docs/design/implementation-backlog.md` §9. Tests in `tests/test_release_gate.py` cover DOCX upload → ledger chunks/statements, statement/evidence refs on projected graph edges, KB-scoped graph API (no global `/api/graph`), viewer write denial, persistence across process restart, dual-KB graph isolation (HTTP), and tar backup roundtrip; `tests/test_graph_page_limits.py` caps snapshot pagination; `packages/web/src/explorer/host/explorerHttp.test.ts` asserts Explorer HTTP rewrite to `/api/kbs/{id}/…`; `tests/test_legacy_graph_migration.py` covers dry-run legacy graph import; `tests/test_ws_hub.py` covers per-KB WebSocket broadcast isolation; `tests/test_realtime_ws.py` covers `projection_updated` on rebuild and inline ingest.
