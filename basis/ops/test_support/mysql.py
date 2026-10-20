"""MySQL helpers for integration tests (BASIS_TEST_MYSQL_URL)."""

from __future__ import annotations

import uuid

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url


def create_mysql_database(admin_url: str) -> str:
    database = f"basis_test_{uuid.uuid4().hex}"
    parsed = make_url(admin_url)
    admin_db = parsed.database or "mysql"
    admin_dsn = parsed.set(database=admin_db).render_as_string(hide_password=False)
    engine = create_engine(admin_dsn, isolation_level="AUTOCOMMIT")
    with engine.connect() as conn:
        conn.execute(
            text(f"CREATE DATABASE `{database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        )
    engine.dispose()
    return parsed.set(database=database).render_as_string(hide_password=False)


def drop_mysql_database(admin_url: str, database_url: str) -> None:
    parsed = make_url(database_url)
    db_name = parsed.database
    if not db_name:
        return
    admin_dsn = make_url(admin_url).set(
        database=make_url(admin_url).database or "mysql"
    ).render_as_string(hide_password=False)
    engine = create_engine(admin_dsn, isolation_level="AUTOCOMMIT")
    with engine.connect() as conn:
        conn.execute(text(f"DROP DATABASE IF EXISTS `{db_name}`"))
    engine.dispose()
