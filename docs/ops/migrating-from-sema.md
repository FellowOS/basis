# Migrating from Sema to Basis

The product was renamed **Sema → Basis** for open source. The Python package is `basis`, the CLI is `uv run basis`, and configuration uses **`BASIS_*`** environment variables.

## Configuration

| Old (Sema) | New (Basis) |
| --- | --- |
| `SEMA_HOST` / `SEMA_PORT` | `BASIS_HOST` / `BASIS_PORT` |
| `SEMA_DATA_DIR` | `BASIS_DATA_DIR` |
| `SEMA_DATABASE_URL` | `BASIS_DATABASE_URL` |
| `SEMA_INGEST_INLINE`, `SEMA_MCP_*`, … | `BASIS_INGEST_INLINE`, `BASIS_MCP_*`, … |

Copy values from `.env` using [.env.example](../../.env.example) as the template.

## Data directory

- SQLite file name is **`basis.db`** (not `sema.db`). You can rename `sema.db` → `basis.db` in your data dir or point `BASIS_DATA_DIR` at a fresh tree and restore from backup.
- Blobs and `graphs/` paths are unchanged under `BASIS_DATA_DIR`.

## Web console

- Local storage key for the session token is **`basis_token`** (was `sema_token`). Users must sign in again after deploy.

## Backups

Backup scripts now write `basis-data-*`, `basis-pg-*`, `basis-blobs-*`, and `basis-graphs-*` archives. See [backup-and-restore.md](backup-and-restore.md).

## Repository

- GitHub: [github.com/fellowos/basis](https://github.com/fellowos/basis)
- Clone: `git clone https://github.com/fellowos/basis.git`

No automatic in-process migration from the old `sema` Python import path is provided; deploy the `basis` package and updated `@basis/web` build together.
