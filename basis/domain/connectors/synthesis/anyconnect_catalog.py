"""AnyConnect ``catalog/apps/{service}.json`` → BOCP procedure actions (P3)."""

from __future__ import annotations

import json
from typing import Any

from basis.domain.connectors.manifest_actions import procedure_action_from_tool
from basis.domain.connectors.manifest_schema import (
    ProcedureActionSpec,
    RestEntityExecutorSpec,
    RestOperationSpec,
    ToolAnnotationsSpec,
    ToolSpec,
)
from basis.domain.connectors.synthesis.executor_index import invoke_wire_for_action
from basis.domain.connectors.synthesis.paths import anyconnect_catalog_dir


def _catalog_file_for_service(service: str) -> Any:
    root = anyconnect_catalog_dir()
    if root is None:
        return None
    for name in (f"{service}.json", f"{service.replace('_', '-')}.json"):
        path = root / name
        if path.is_file():
            return json.loads(path.read_text(encoding="utf-8"))
    return None


def _short_action_name(action_id: str) -> str:
    if "." in action_id:
        return action_id.split(".")[-1]
    return action_id


def procedures_from_anyconnect_app(
    app: dict[str, Any],
    *,
    service: str,
) -> list[ProcedureActionSpec]:
    procedures: list[ProcedureActionSpec] = []
    for item in app.get("actions") or []:
        if not isinstance(item, dict):
            continue
        action_id = str(item.get("id") or item.get("name") or "").strip()
        if not action_id:
            continue
        wire = invoke_wire_for_action(service, action_id)
        method = wire.get("method", "POST") if wire else "POST"
        path = wire.get("path", "") if wire else ""
        input_schema = item.get("inputSchema") or item.get("input_schema") or {}
        output_schema = item.get("outputSchema") or item.get("output_schema") or {}
        if not isinstance(input_schema, dict):
            input_schema = {}
        if not isinstance(output_schema, dict):
            output_schema = {}
        scopes = item.get("requiredScopes") or item.get("required_scopes") or []
        if not isinstance(scopes, list):
            scopes = []
        name = _short_action_name(action_id)
        tool = ToolSpec(
            id=action_id,
            name=name,
            description=str(item.get("description") or ""),
            required_scopes=[str(s) for s in scopes],
            annotations=ToolAnnotationsSpec(
                read_only_hint=method == "GET",
                destructive_hint=False,
                idempotent_hint=method == "GET",
            ),
            input_schema=input_schema,
            output_schema=output_schema,
            http_method=method,
            path_template=path,
        )
        proc = procedure_action_from_tool(tool)
        if not path and proc.rest is not None:
            # Mark catalog-only invoke until executor index fills path (P4).
            proc = proc.model_copy(
                update={
                    "x-basis-invoke-status": "catalog-only",
                }
            )
        procedures.append(proc)
    return procedures


def anyconnect_app_metadata(app: dict[str, Any]) -> dict[str, Any]:
    display = app.get("displayName") or app.get("display_name") or app.get("name")
    description = app.get("description") or ""
    categories = app.get("categories") or app.get("category") or []
    if isinstance(categories, str):
        categories = [categories]
    homepage = app.get("homepageUrl") or app.get("homepage_url")
    docs = app.get("docsUrl") or app.get("docs_url")
    return {
        "display_name": str(display or "").strip() or None,
        "description": str(description).strip() or None,
        "categories": [str(c) for c in categories] if isinstance(categories, list) else [],
        "homepage_url": homepage if isinstance(homepage, str) else None,
        "docs_url": docs if isinstance(docs, str) else None,
    }


def load_anyconnect_procedures(service: str) -> tuple[dict[str, Any], list[ProcedureActionSpec]] | None:
    app = _catalog_file_for_service(service)
    if app is None:
        return None
    meta = anyconnect_app_metadata(app)
    return meta, procedures_from_anyconnect_app(app, service=service)
