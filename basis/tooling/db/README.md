# `basis.tooling.db`

Storage schema and migration tooling (not domain business logic).

| Path | Role |
| --- | --- |
| `migrations/*.sql` | Ordered SQLite/PostgreSQL DDL (shipped in the wheel via `pyproject.toml` `package-data`) |
| `sqlite_migrations.py` | Apply SQL files to a `sqlite3.Connection` |
| `postgres_migrations.py` | Apply PG equivalents on a SQLAlchemy `Engine` |
| `org_backfill.py` | Idempotent org rows for legacy KBs (invoked at end of migration runs) |
| `alembic/` | Optional Alembic entry (`alembic.ini` → `script_location` here) |
| `schema.py` | SQLAlchemy metadata used by Alembic |

**Imports:** `basis.tooling.db.sqlite_migrations` / `postgres_migrations` only (removed platform re-export shims; CI `audit-compat-shim-imports.py`).

Runtime pools: `basis.runtime.database` calls into this package when opening SQLite/Postgres databases.
