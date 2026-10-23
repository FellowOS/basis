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


def load_integration_test_env() -> Path | None:
    """Load ``.env.test`` without overriding variables already set in the environment."""
    path = integration_test_env_path()
    if not path.is_file():
        return None
    from dotenv import load_dotenv

    load_dotenv(path, override=False)
    return path
