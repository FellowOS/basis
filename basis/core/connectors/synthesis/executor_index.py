"""Optional static map: AnyConnect action id → REST invoke wire (P4 build artifact)."""

from __future__ import annotations

import json
from typing import Any

from basis.core.connectors.synthesis.paths import executor_index_path


def _load_index() -> dict[str, Any]:
    path = executor_index_path()
    if path is None:
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


def invoke_wire_for_action(service: str, action_id: str) -> dict[str, str] | None:
    """Return ``{"method": "GET|POST|...", "path": "/..."}`` when known."""
    index = _load_index()
    by_service = index.get(service)
    if isinstance(by_service, dict):
        wire = by_service.get(action_id) or by_service.get(action_id.split(".")[-1])
        if isinstance(wire, dict):
            method = str(wire.get("method") or "POST").upper()
            path = str(wire.get("path") or "")
            if path:
                return {"method": method, "path": path}
    if service == "slack":
        from basis.core.connectors.synthesis.slack_invoke_map import slack_invoke_wire

        return slack_invoke_wire(action_id)
    if service == "gitlab":
        from basis.core.connectors.synthesis.gitlab_invoke_map import gitlab_invoke_wire

        return gitlab_invoke_wire(action_id)
    if service == "jira":
        from basis.core.connectors.synthesis.jira_invoke_map import jira_invoke_wire

        return jira_invoke_wire(action_id)
    return None
