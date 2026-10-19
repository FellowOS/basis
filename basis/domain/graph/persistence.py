"""Backward-compatible import path — prefer ``basis.domain.graph.snapshot_store``."""

from basis.domain.graph.snapshot_store import GraphPersistence, GraphSnapshotMeta

__all__ = ["GraphPersistence", "GraphSnapshotMeta"]
