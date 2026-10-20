"""Basis storage baseline for SQLite and PostgreSQL.

Revision ID: 0001_storage_baseline
"""

from alembic import op

from basis.tooling.db.postgres_migrations import run_postgres_migrations
from basis.tooling.db.sqlite_migrations import run_migrations

revision = "0001_storage_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        raw = bind.connection.driver_connection
        run_migrations(raw)
    else:
        run_postgres_migrations(bind.engine)


def downgrade() -> None:
    raise RuntimeError("The canonical Basis baseline cannot be downgraded destructively")
