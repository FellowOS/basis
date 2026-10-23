# `basis.infra.tooling.db`

Storage schema and migration tooling (not domain business logic).

| Path | Role |
| --- | --- |
| `migrations/*.sql` | Canonical baseline DDL (Alembic `0001`; Postgres extras in `0002`) |
| `alembic/` | Alembic revisions (`alembic.ini` at repo root) |
| `alembic_upgrade.py` | Runtime/CLI entry: `alembic upgrade head` |
| `sqlite_migrations.py` | SQLite bootstrap helpers (revision `0001`) |
| `postgres_migrations.py` | PostgreSQL bootstrap + extensions (revision `0001`) |
| `org_backfill.py` | Idempotent org rows for legacy KBs |
| `schema.py` | SQLAlchemy metadata for Alembic / tooling |

**Config (single source of truth)**

| Priority | Source | SQLite default |
| --- | --- | --- |
| 1 | `BASIS_DATABASE_URL` | `sqlite:///…` or `postgresql://…` |
| 2 | `BASIS_DATA_DIR` + `basis.db` | `./data/basis.db` when env unset |

`alembic.ini` → `sqlalchemy.url` is only the CLI fallback when `BASIS_DATABASE_URL` is unset and you run from repo root with `BASIS_DATA_DIR=data`.

**Apply schema:** `upgrade_sqlite_file(path)` / `upgrade_postgres_engine(engine)` in `alembic_upgrade.py`, or:

```bash
# load .env first so BASIS_DATABASE_URL is visible to env.py
uv run alembic -c alembic.ini upgrade head
```

Runtime: `basis.infra.runtime.database` calls `alembic_upgrade` when opening SQLite/Postgres.
