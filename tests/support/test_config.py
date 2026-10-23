"""Load test-harness settings from ``tests/test.yaml`` (not app ``.env``).

Override path: ``BASIS_TEST_CONFIG``. Process environment overrides YAML values
when applying config to ``os.environ``.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml

from tests.support.repo_root import REPO_ROOT

_DEFAULT_CONFIG = REPO_ROOT / "tests" / "test.yaml"


def test_config_path() -> Path:
    raw = os.environ.get("BASIS_TEST_CONFIG", "").strip()
    if raw:
        return Path(raw).expanduser().resolve()
    return _DEFAULT_CONFIG


def load_test_config() -> dict[str, Any]:
    path = test_config_path()
    if not path.is_file():
        return {}
    loaded = yaml.safe_load(path.read_text(encoding="utf-8"))
    return loaded if isinstance(loaded, dict) else {}


def _setenv_if_empty(key: str, value: str | None) -> None:
    if not value or not str(value).strip():
        return
    if key not in os.environ or not os.environ[key].strip():
        os.environ[key] = str(value).strip()


def apply_test_config() -> Path | None:
    """Merge Postgres settings from YAML into ``os.environ`` for pytest fixtures."""
    path = test_config_path()
    cfg = load_test_config()
    pg = cfg.get("postgres") if isinstance(cfg.get("postgres"), dict) else {}
    if isinstance(pg, dict):
        _setenv_if_empty("BASIS_TEST_POSTGRES_URL", pg.get("admin_url"))
        _setenv_if_empty("BASIS_TEST_POSTGRES_EXTERNAL_URL", pg.get("sql_target_url"))
    return path if path.is_file() else None
