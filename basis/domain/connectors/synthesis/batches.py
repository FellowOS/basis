"""Batch definitions for ``build_connector_manifests.py --batch``."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import yaml

from basis.domain.connectors.synthesis.paths import batches_dir


@dataclass(frozen=True)
class ProviderBatch:
    id: int
    name: str
    ship_tier_default: str
    services: list[str]


def load_batch(batch_id: int) -> ProviderBatch:
    path = batches_dir() / f"batch_{batch_id}.yaml"
    if not path.is_file():
        raise FileNotFoundError(f"Batch file not found: {path}")
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError(f"Invalid batch file: {path}")
    services = raw.get("services")
    if not isinstance(services, list) or not services:
        raise ValueError(f"Batch {batch_id} must list at least one service")
    return ProviderBatch(
        id=int(raw.get("id", batch_id)),
        name=str(raw.get("name") or f"batch_{batch_id}"),
        ship_tier_default=str(raw.get("ship_tier_default") or "beta"),
        services=[str(s).strip().lower() for s in services],
    )


def list_batch_files() -> list[Path]:
    root = batches_dir()
    return sorted(root.glob("batch_*.yaml"))
