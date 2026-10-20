"""Resolve upstream asset paths for provider synthesis (Nango / Airbyte / AnyConnect)."""

from __future__ import annotations

import os
from pathlib import Path


def repo_root() -> Path:
    return Path(__file__).resolve().parents[4]


def batches_dir() -> Path:
    return Path(__file__).resolve().parent / "batches"


def nango_providers_yaml() -> Path | None:
    raw = os.environ.get("BASIS_SYNTHESIS_NANGO_PROVIDERS", "").strip()
    if raw:
        path = Path(raw).expanduser()
        return path if path.is_file() else None
    monorepo = repo_root().parent
    candidates = [
        monorepo.parent / "nango" / "packages" / "providers" / "providers.yaml",
        monorepo / "nango" / "packages" / "providers" / "providers.yaml",
    ]
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    return None


def anyconnect_catalog_dir() -> Path | None:
    raw = os.environ.get("BASIS_SYNTHESIS_ANYCONNECT_CATALOG", "").strip()
    if raw:
        path = Path(raw).expanduser()
        return path if path.is_dir() else None
    monorepo = repo_root().parent
    candidates = [
        monorepo / "connectors" / "catalog" / "apps",
        monorepo.parent / "fellowos" / "connectors" / "catalog" / "apps",
    ]
    for candidate in candidates:
        if candidate.is_dir():
            return candidate
    return None


def airbyte_connectors_root() -> Path | None:
    raw = os.environ.get("BASIS_SYNTHESIS_AIRBYTE_ROOT", "").strip()
    if raw:
        path = Path(raw).expanduser()
        return path if path.is_dir() else None
    monorepo = repo_root().parent
    candidate = (
        monorepo.parent
        / "airbyte"
        / "airbyte-integrations"
        / "connectors"
    )
    return candidate if candidate.is_dir() else None


def executor_index_path() -> Path | None:
    raw = os.environ.get("BASIS_SYNTHESIS_EXECUTOR_INDEX", "").strip()
    if raw:
        path = Path(raw).expanduser()
        return path if path.is_file() else None
    candidate = Path(__file__).resolve().parent / "executors-index.json"
    return candidate if candidate.is_file() else None
