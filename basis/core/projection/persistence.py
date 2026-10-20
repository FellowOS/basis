"""Backward-compatible import path — prefer ``basis.core.projection.snapshot_store``."""

from basis.core.projection.snapshot_store import GraphPersistence, GraphSnapshotMeta

__all__ = ["GraphPersistence", "GraphSnapshotMeta"]
