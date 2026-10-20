"""KB domain ports (platform adapters implement these in transport/integration)."""

from basis.core.ledger.ports.platform import EmbedSettingsStore, KbAuditActor, KbAuditStore

__all__ = ["EmbedSettingsStore", "KbAuditActor", "KbAuditStore"]
