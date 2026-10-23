"""Load connector integration test variables from ``.env.test`` (see ``.env.test.example``)."""

from __future__ import annotations

import os
from pathlib import Path

from tests.support.repo_root import REPO_ROOT as _REPO_ROOT


def integration_test_env_path() -> Path:
    raw = os.environ.get("BASIS_TEST_ENV_FILE", "").strip()
    if raw:
        return Path(raw).expanduser().resolve()
    return _REPO_ROOT / ".env.test"


def _sync_postgres_test_urls_from_app_env() -> None:
    """Default ``BASIS_TEST_POSTGRES_*`` from ``BASIS_DATABASE_URL`` in ``.env`` when unset."""
    if os.environ.get("BASIS_TEST_POSTGRES_URL", "").strip():
        return
    db_url = os.environ.get("BASIS_DATABASE_URL", "").strip()
    if not db_url:
        return
    os.environ["BASIS_TEST_POSTGRES_URL"] = db_url
    if not os.environ.get("BASIS_TEST_POSTGRES_EXTERNAL_URL", "").strip():
        os.environ["BASIS_TEST_POSTGRES_EXTERNAL_URL"] = db_url


def load_integration_test_env() -> Path | None:
    """Load ``.env.test`` then ``.env`` (neither overrides existing env vars)."""
    from dotenv import load_dotenv

    loaded: Path | None = None
    env_test = integration_test_env_path()
    if env_test.is_file():
        load_dotenv(env_test, override=False)
        loaded = env_test
    env_file = _REPO_ROOT / ".env"
    if env_file.is_file():
        load_dotenv(env_file, override=False)
    _sync_postgres_test_urls_from_app_env()
    return loaded
