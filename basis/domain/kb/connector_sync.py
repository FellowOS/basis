"""Backward-compatible import path — implementation in ``services/connector_sync``."""

from basis.domain.kb.services.connector_sync import (
    ConnectorLedgerSyncService,
    InboundSyncStats,
    SourceTableMappingRecord,
)

__all__ = [
    "ConnectorLedgerSyncService",
    "InboundSyncStats",
    "SourceTableMappingRecord",
]
