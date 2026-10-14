# Backup and restore (Sema data plane)

Canonical state lives in the **admin database** (SQLite file or PostgreSQL), **content blobs** under `SEMA_DATA_DIR`, and **per-KB graph JSON** under the same tree. Graph projections can be **rebuilt** from the ledger after restore; you must not lose the ledger or blobs.

## What to back up

| Asset | Typical path / note |
| --- | --- |
| SQLite DB | `$SEMA_DATA_DIR/sema.db` when `SEMA_DATABASE_URL` is unset |
| PostgreSQL | Logical dump of the Sema database (see below) |
| Blobs | `$SEMA_DATA_DIR/blobs/` (content-addressed) |
| Graph snapshots | `$SEMA_DATA_DIR/graphs/` (optional to backup; rebuildable) |

## Quick backup (SQLite / dev)

```bash
./scripts/backup_sema_data.sh
```

Creates `backups/sema-data-YYYYMMDD-HHMMSS.tar.gz` containing `sema.db`, `blobs/`, and `graphs/`.

## Restore (SQLite)

1. Stop the API process.
2. Extract the archive into `SEMA_DATA_DIR` (or replace the directory).
3. Start the API and sign in with the **same accounts** that existed when the backup was taken (user rows live in `sema.db`).
4. For each KB (or via automation), call `POST /api/kbs/{kb_id}/graph/rebuild` as an **editor** to refresh projections from the ledger. This is required if `graphs/` was omitted from the archive or was deleted after restore.

## PostgreSQL

```bash
pg_dump "$SEMA_DATABASE_URL" -Fc -f sema-$(date +%Y%m%d).dump
```

Restore with `pg_restore` into an empty database, then restore blobs from tar as above. Rebuild graph projections per KB.

## Related

- Runtime caps and ingest env vars: [runtime-limits.md](./runtime-limits.md)

## Verification

After restore + rebuild:

- Documents list matches expectations (`GET /api/kbs/{id}/documents`).
- `GET /api/kbs/{id}/graph/snapshot` includes expected document nodes.
- Automated checks: `pytest tests/test_release_gate.py`.

## Release gate

See `docs/design/implementation-backlog.md` §9. Tests in `tests/test_release_gate.py` cover DOCX upload → ledger chunks/statements, statement/evidence refs on projected graph edges, KB-scoped graph API (no global `/api/graph`), viewer write denial, persistence across process restart, dual-KB graph isolation (HTTP), and tar backup roundtrip; `tests/test_graph_page_limits.py` caps snapshot pagination; `packages/web/src/explorer/host/explorerHttp.test.ts` asserts Explorer HTTP rewrite to `/api/kbs/{id}/…`; `tests/test_legacy_graph_migration.py` covers dry-run legacy graph import; `tests/test_ws_hub.py` covers per-KB WebSocket broadcast isolation; `tests/test_realtime_ws.py` covers `projection_updated` on rebuild and inline ingest.
