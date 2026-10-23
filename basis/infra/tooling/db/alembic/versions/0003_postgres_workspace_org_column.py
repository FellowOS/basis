"""Ensure ``workspaces.organization_id`` exists (legacy PG installs; no-op on SQLite).

Revision ID: 0003_postgres_workspace_org_column
"""

from __future__ import annotations

from alembic import op

from basis.infra.tooling.db.postgres_migrations import ensure_workspace_organization_id_column

revision = "0003_postgres_workspace_org_column"
down_revision = "0002_postgres_storage_extras"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    ensure_workspace_organization_id_column(bind)


def downgrade() -> None:
    raise RuntimeError("workspaces.organization_id repair cannot be downgraded")
