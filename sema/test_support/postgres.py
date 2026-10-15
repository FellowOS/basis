"""PostgreSQL helpers for integration tests (SEMA_TEST_POSTGRES_URL)."""

from __future__ import annotations

import uuid

import psycopg
from psycopg import sql
from sqlalchemy.engine import make_url


def create_postgres_database(admin_url: str) -> str:
    database = f"sema_test_{uuid.uuid4().hex}"
    parsed = make_url(admin_url)
    admin_dsn = parsed.set(database=parsed.database or "postgres").render_as_string(
        hide_password=False
    )
    with psycopg.connect(admin_dsn, autocommit=True) as conn:
        conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database)))
    return parsed.set(database=database).render_as_string(hide_password=False)


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
