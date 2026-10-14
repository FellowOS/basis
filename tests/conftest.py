import pytest

from sema.database import reset_sqlite_database_pool


@pytest.fixture(autouse=True)
def _isolate_sqlite_pool() -> None:
    yield
    reset_sqlite_database_pool()
