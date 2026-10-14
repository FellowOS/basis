"""Uvicorn log_config when SEMA_LOG_JSON is enabled (X-02)."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from sema.observability.redaction import redact_string


class UvicornAccessJsonFormatter(logging.Formatter):
    """Structured JSON access lines (method, path, status) with query redaction."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "event": "http_access",
        }
        rid = getattr(record, "request_id", None)
        if isinstance(rid, str) and rid.strip():
            payload["request_id"] = rid.strip()
        args = record.args
        if isinstance(args, tuple) and len(args) == 5:
            client_addr, method, full_path, http_version, status_code = args
            payload["client_addr"] = client_addr
            payload["method"] = method
            payload["path"] = redact_string(str(full_path))
            payload["http_version"] = http_version
            try:
                payload["status_code"] = int(status_code)
            except (TypeError, ValueError):
                payload["status_code"] = status_code
        else:
            payload["message"] = redact_string(record.getMessage())
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False, default=str)


def build_uvicorn_log_config() -> dict[str, Any]:
    """dictConfig for uvicorn + JSON access/error lines."""
    return {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "sema_json": {
                "()": "sema.observability.json_logging.JsonLogFormatter",
            },
            "access_json": {
                "()": "sema.observability.uvicorn_logging.UvicornAccessJsonFormatter",
            },
        },
        "filters": {
            "request_id": {
                "()": "sema.api.request_id.RequestIdLogFilter",
            },
        },
        "handlers": {
            "default": {
                "formatter": "sema_json",
                "class": "logging.StreamHandler",
                "stream": "ext://sys.stderr",
                "filters": ["request_id"],
            },
            "access": {
                "formatter": "access_json",
                "class": "logging.StreamHandler",
                "stream": "ext://sys.stdout",
                "filters": ["request_id"],
            },
        },
        "loggers": {
            "uvicorn": {"handlers": ["default"], "level": "INFO", "propagate": False},
            "uvicorn.error": {"handlers": ["default"], "level": "INFO", "propagate": False},
            "uvicorn.access": {"handlers": ["access"], "level": "INFO", "propagate": False},
        },
    }
