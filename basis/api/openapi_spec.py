"""Load committed OpenAPI v1 YAML from the repository."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

_REPO_ROOT = Path(__file__).resolve().parents[2]
_OPENAPI_DIR = _REPO_ROOT / "openapi"


@lru_cache(maxsize=4)
def _load_yaml(name: str) -> dict[str, Any]:
    path = _OPENAPI_DIR / name
    if not path.is_file():
        raise FileNotFoundError(f"OpenAPI spec not found: {path}")
    with path.open(encoding="utf-8") as f:
        data = yaml.safe_load(f)
    if not isinstance(data, dict):
        raise ValueError(f"Invalid OpenAPI document: {path}")
    return data


def openapi_v1_full() -> dict[str, Any]:
    return _load_yaml("basis-v1.yaml")


def openapi_v1_platform() -> dict[str, Any]:
    return _load_yaml("basis-v1-platform.yaml")


def openapi_v1_kb() -> dict[str, Any]:
    return _load_yaml("basis-v1-kb.yaml")


def openapi_v1_json(name: str) -> str:
    """Stable JSON serialization for HTTP responses and CI comparisons."""
    doc = _load_yaml(name)
    return json.dumps(doc, sort_keys=True, ensure_ascii=False)
