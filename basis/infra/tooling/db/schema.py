"""Portable SQLAlchemy metadata for the core Basis storage contract.

Complex projections (SQLite FTS5 and PostgreSQL pgvector partitions) remain in
dialect migrations, while canonical tables are represented here for tooling.
"""

from sqlalchemy import (
    BigInteger,
    Column,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    Table,
    Text,
    UniqueConstraint,
)

metadata = MetaData()

users = Table(
    "users",
    metadata,
    Column("id", Text, primary_key=True),
    Column("email", Text, nullable=False),
    Column("display_name", Text, nullable=False),
    Column("password_hash", Text, nullable=False),
    Column("is_admin", Integer, nullable=False, server_default="0"),
    Column("deactivated_at", Text),
    Column("created_at", Text, nullable=False),
)
Index("users_email_active", users.c.email, unique=True, postgresql_where=users.c.deactivated_at.is_(None))

workspaces = Table(
    "workspaces",
    metadata,
    Column("id", Text, primary_key=True),
    Column("name", Text, nullable=False),
    Column("description", Text, nullable=False, server_default=""),
    Column("visibility", Text, nullable=False),
    Column("created_by", Text, nullable=False),
    Column("created_at", Text, nullable=False),
)

documents = Table(
    "documents",
    metadata,
    Column("id", Text, primary_key=True),
    Column("workspace_id", Text, ForeignKey("workspaces.id"), nullable=False),
    Column("source_id", Text),
    Column("external_key", Text),
    Column("title", Text, nullable=False),
    Column("mime_type", Text, nullable=False),
    Column("current_version_id", Text),
    Column("created_by", Text),
    Column("created_at", Text, nullable=False),
    Column("deleted_at", Text),
)

document_versions = Table(
    "document_versions",
    metadata,
    Column("id", Text, primary_key=True),
    Column("workspace_id", Text, ForeignKey("workspaces.id"), nullable=False),
    Column("document_id", Text, ForeignKey("documents.id"), nullable=False),
    Column("version_no", Integer, nullable=False),
    Column("sha256", Text, nullable=False),
    Column("blob_key", Text, nullable=False),
    Column("byte_size", BigInteger, nullable=False),
    Column("source_time", Text),
    Column("source_time_kind", Text),
    Column("status", Text, nullable=False),
    Column("error_code", Text),
    Column("error_detail_json", Text),
    Column("created_at", Text, nullable=False),
    Column("ready_at", Text),
    UniqueConstraint("document_id", "version_no"),
)

chunks = Table(
    "chunks",
    metadata,
    Column("id", Text, primary_key=True),
    Column("workspace_id", Text, ForeignKey("workspaces.id"), nullable=False),
    Column("version_id", Text, ForeignKey("document_versions.id"), nullable=False),
    Column("ordinal", Integer, nullable=False),
    Column("text", Text, nullable=False),
    Column("heading", Text),
    Column("char_start", Integer),
    Column("char_end", Integer),
    Column("token_count", Integer),
    Column("language", Text),
    Column("origin", Text, nullable=False, server_default="stated"),
    Column("anchor_json", Text),
    Column("created_at", Text, nullable=False),
    UniqueConstraint("version_id", "ordinal"),
)
Index("chunks_workspace_created", chunks.c.workspace_id, chunks.c.created_at)

embedding_records = Table(
    "embedding_records",
    metadata,
    Column("id", Text, primary_key=True),
    Column("workspace_id", Text, ForeignKey("workspaces.id"), nullable=False),
    Column("chunk_id", Text, ForeignKey("chunks.id"), nullable=False),
    Column("model_ref", Text, nullable=False),
    Column("dimension", Integer, nullable=False),
    Column("content_sha256", Text, nullable=False),
    Column("vector_key", Text, nullable=False),
    Column("created_at", Text, nullable=False),
    UniqueConstraint("chunk_id", "model_ref"),
)

search_configs = Table(
    "search_configs",
    metadata,
    Column("workspace_id", Text, ForeignKey("workspaces.id"), primary_key=True),
    Column("schema_version", Integer, nullable=False, server_default="1"),
    Column("chunk_backend", Text, nullable=False),
    Column("vector_backend", Text, nullable=False),
    Column("embedding_model_id", Text),
    Column("keyword_enabled", Integer, nullable=False, server_default="1"),
    Column("semantic_enabled", Integer, nullable=False, server_default="1"),
    Column("default_mode", Text, nullable=False),
    Column("auto_index", Integer, nullable=False, server_default="1"),
    Column("created_at", Text, nullable=False),
    Column("updated_at", Text, nullable=False),
)
