# `basis.infra.tooling.db`

Storage schema and migration tooling (not domain business logic).

| Path | Role |
| --- | --- |
| `migrations/*.sql` | Canonical baseline DDL (applied inside Alembic `0001`) |
| `alembic/` | Alembic revisions (`alembic.ini` at repo root) |
| `alembic_upgrade.py` | Runtime/CLI entry: `alembic upgrade head` |
| `sqlite_migrations.py` | SQLite bootstrap helpers (revision `0001`) |
| `postgres_migrations.py` | PostgreSQL bootstrap + extensions (revision `0001`) |
| `org_backfill.py` | Idempotent org rows for legacy KBs |
| `schema.py` | SQLAlchemy metadata for Alembic / tooling |

**Apply schema:** `upgrade_sqlite_file(path)` or `upgrade_postgres_engine(engine)` from `alembic_upgrade.py` (also `uv run alembic -c alembic.ini upgrade head` with `BASIS_DATABASE_URL` or `sqlalchemy.url`).

Runtime pools: `basis.infra.runtime.database` calls `alembic_upgrade` when opening SQLite/Postgres.
