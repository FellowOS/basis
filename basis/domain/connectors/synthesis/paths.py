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
    candidate = repo_root().parent / "nango" / "packages" / "providers" / "providers.yaml"
    return candidate if candidate.is_file() else None


def anyconnect_catalog_dir() -> Path | None:
    raw = os.environ.get("BASIS_SYNTHESIS_ANYCONNECT_CATALOG", "").strip()
    if raw:
        path = Path(raw).expanduser()
        return path if path.is_dir() else None
    candidate = repo_root().parent / "fellowos" / "connectors" / "catalog" / "apps"
    return candidate if candidate.is_dir() else None


def airbyte_connectors_root() -> Path | None:
    raw = os.environ.get("BASIS_SYNTHESIS_AIRBYTE_ROOT", "").strip()
    if raw:
        path = Path(raw).expanduser()
        return path if path.is_dir() else None
    candidate = (
        repo_root().parent
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
