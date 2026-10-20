"""PostgreSQL helpers for integration tests (BASIS_TEST_POSTGRES_URL)."""

from __future__ import annotations

import uuid

import psycopg
from psycopg import sql
from sqlalchemy.engine import make_url


def create_postgres_database(admin_url: str) -> str:
    url, created = try_create_postgres_database(admin_url)
    if not created:
        raise psycopg.errors.InsufficientPrivilege(
            "CREATEDB not allowed; use BASIS_TEST_POSTGRES_EXTERNAL_URL or a superuser admin URL"
        )
    return url


def try_create_postgres_database(admin_url: str) -> tuple[str, bool]:
    """Create an ephemeral test database, or reuse the URL's database when CREATEDB is denied."""
    database = f"basis_test_{uuid.uuid4().hex}"
    parsed = make_url(admin_url)
    admin_dsn = parsed.set(database=parsed.database or "postgres").render_as_string(
        hide_password=False
    )
    try:
        with psycopg.connect(admin_dsn, autocommit=True) as conn:
            conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database)))
    except psycopg.errors.InsufficientPrivilege:
        target = parsed.set(database=parsed.database or "postgres")
        return target.render_as_string(hide_password=False), False
    return parsed.set(database=database).render_as_string(hide_password=False), True


def drop_postgres_database(admin_url: str, database_url: str) -> None:
    parsed = make_url(database_url)
    db_name = parsed.database
    if not db_name:
        return
    admin_dsn = make_url(admin_url).set(
        database=make_url(admin_url).database or "postgres"
    ).render_as_string(hide_password=False)
    with psycopg.connect(admin_dsn, autocommit=True) as conn:
        conn.execute(
            sql.SQL("DROP DATABASE IF EXISTS {} WITH (FORCE)").format(
                sql.Identifier(db_name)
            )
        )
