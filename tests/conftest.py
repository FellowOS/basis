import os

import pytest

from basis.database import reset_sqlite_database_pool
from basis.test_support.postgres import create_postgres_database, drop_postgres_database


@pytest.fixture(autouse=True)
def _isolate_sqlite_pool() -> None:
    yield
    reset_sqlite_database_pool()


@pytest.fixture
def postgres_admin_url() -> str:
    admin_url = os.environ.get("BASIS_TEST_POSTGRES_URL")
    if not admin_url:
        pytest.skip("BASIS_TEST_POSTGRES_URL is not configured")
    return admin_url


@pytest.fixture
def postgres_url(postgres_admin_url: str) -> str:
    test_url = create_postgres_database(postgres_admin_url)
    yield test_url
    reset_sqlite_database_pool()
    drop_postgres_database(postgres_admin_url, test_url)
