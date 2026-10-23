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
    """Merge YAML into ``os.environ`` for keys pytest and E2E fixtures expect."""
    path = test_config_path()
    cfg = load_test_config()
    pg = cfg.get("postgres") if isinstance(cfg.get("postgres"), dict) else {}
    if isinstance(pg, dict):
        _setenv_if_empty("BASIS_TEST_POSTGRES_URL", pg.get("admin_url"))
        _setenv_if_empty("BASIS_TEST_POSTGRES_EXTERNAL_URL", pg.get("sql_target_url"))
    gh = cfg.get("github") if isinstance(cfg.get("github"), dict) else {}
    if isinstance(gh, dict):
        _setenv_if_empty("BASIS_TEST_GITHUB_TOKEN", gh.get("token"))
        _setenv_if_empty("BASIS_TEST_GITHUB_OWNER", gh.get("owner"))
        _setenv_if_empty("BASIS_TEST_GITHUB_REPO", gh.get("repo"))
        token = gh.get("token")
        if token:
            _setenv_if_empty("BASIS_E2E_GITHUB_TOKEN", token)
        if gh.get("e2e_run_sync") in (True, "1", 1):
            _setenv_if_empty("BASIS_E2E_GITHUB_RUN_SYNC", "1")
    e2e = cfg.get("e2e") if isinstance(cfg.get("e2e"), dict) else {}
    if isinstance(e2e, dict):
        if e2e.get("api_port") is not None:
            _setenv_if_empty("BASIS_E2E_API_PORT", str(e2e.get("api_port")))
        if e2e.get("web_port") is not None:
            _setenv_if_empty("BASIS_E2E_WEB_PORT", str(e2e.get("web_port")))
        if e2e.get("demo_workspace"):
            _setenv_if_empty("BASIS_DEMO_WORKSPACE", "1")
    return path if path.is_file() else None
