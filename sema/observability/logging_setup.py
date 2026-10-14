"""Central logging configuration for the API process (X-02)."""

from __future__ import annotations

from sema.api.request_id import install_request_id_logging
from sema.config import Settings
from sema.observability.json_logging import install_json_logging


def configure_sema_logging(settings: Settings) -> None:
    install_request_id_logging()
    if settings.log_json:
        install_json_logging()
