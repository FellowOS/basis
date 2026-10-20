"""Build normative OpenAPI v1 from a live FastAPI app (`app.openapi()` + Basis annotations)."""

from __future__ import annotations

import sys
from copy import deepcopy
from typing import TYPE_CHECKING, Literal

if TYPE_CHECKING:
    from fastapi import FastAPI

Surface = Literal["public", "platform", "knowledge-base"]

_KB_SESSION_ONLY_SUFFIXES = (
    "/tokens",
    "/members",
)


def _v1_path(path: str) -> str | None:
    if path in ("/docs", "/docs/oauth2-redirect", "/redoc", "/openapi.json"):
        return None
    if path == "/health":
        return "/api/v1/health"
    if path.startswith("/api/v1/"):
        return path
    if path.startswith("/api/"):
        return "/api/v1/" + path[len("/api/") :]
    return path


def classify_surface(path: str) -> Surface:
    if path in ("/api/v1/health",) or path.startswith("/api/v1/auth/"):
        return "public"
    if path.startswith(
        (
            "/api/v1/admin/",
            "/api/v1/platform/",
            "/api/v1/settings/",
            "/api/v1/models",
            "/api/v1/model-providers",
            "/api/v1/orgs/",
            "/api/v1/users",
            "/api/v1/audit",
            "/api/v1/reason/",
        )
    ):
        return "platform"
    if path == "/api/v1/kbs":
        return "platform"
    if path.startswith("/api/v1/kbs/{kb_id}"):
        for suffix in _KB_SESSION_ONLY_SUFFIXES:
            if path.endswith(suffix) or f"{suffix}/" in path:
                return "platform"
        return "knowledge-base"
    return "platform"


def assert_operation_descriptions(paths: dict) -> None:
    missing: list[str] = []
    for path, path_item in paths.items():
        for method, op in path_item.items():
            if method.startswith("x-") or not isinstance(op, dict):
                continue
            desc = str(op.get("description") or "").strip()
            if desc:
                continue
            operation_id = str(op.get("operationId") or f"{method.upper()} {path}")
            missing.append(operation_id)
    if missing:
        print(
            "OpenAPI export failed: add handler docstrings for these operations:",
            file=sys.stderr,
        )
        for oid in sorted(missing):
            print(f"  - {oid}", file=sys.stderr)
        raise SystemExit(1)


def _annotate_surfaces(paths: dict) -> None:
    for path, path_item in paths.items():
        surface = classify_surface(path)
        for method, op in path_item.items():
            if method.startswith("x-") or not isinstance(op, dict):
                continue
            op["x-basis-surface"] = surface
            if surface == "platform":
                op.setdefault("x-basis-auth", "session")
            elif surface == "knowledge-base":
                op.setdefault("x-basis-auth", "session-or-kb-api-token")
            else:
                op.setdefault("x-basis-auth", "public-or-session")


def _security_components() -> dict:
    return {
        "sessionAuth": {
            "type": "http",
            "scheme": "bearer",
            "description": "User session JWT from POST /api/v1/auth/login (console / platform admin).",
        },
        "kbApiTokenAuth": {
            "type": "http",
            "scheme": "bearer",
            "description": (
                "KB-scoped API token (read or write). Token must include this kb_id. "
                "Same tokens as MCP (Authorization: Bearer). Created under KB settings (session only)."
            ),
        },
    }


def export_openapi_v1_document(
    app: FastAPI,
    *,
    assert_descriptions: bool = False,
) -> dict:
    """Export OpenAPI v1 from the running app (same shape as committed YAML when up to date)."""
    schema = deepcopy(app.openapi())
    paths: dict = {}
    for path, item in schema.get("paths", {}).items():
        mapped = _v1_path(path)
        if mapped is None:
            continue
        paths[mapped] = item
    _annotate_surfaces(paths)
    if assert_descriptions:
        assert_operation_descriptions(paths)
    schema["paths"] = dict(sorted(paths.items()))
    schema["openapi"] = "3.1.0"
    schema["info"] = {
        "title": "Basis API",
        "version": "1.0.0",
        "description": (
            "Normative HTTP contract for Basis. Paths use /api/v1 prefix.\n\n"
            "**Two surfaces** (see x-basis-surface on each operation):\n"
            "- `platform` — console & system/org admin; **session JWT** (`sessionAuth`).\n"
            "- `knowledge-base` — KB data & integration (MCP parity); **session or KB API token** "
            "(`kbApiTokenAuth`).\n\n"
            "Split specs: `/openapi/v1/platform.json`, `/openapi/v1/kb.json` (KB **integration** contract). "
            "Console-only routes may appear here but are omitted from the KB integration slice "
            "(see x-basis-audience: console). MCP: POST /api/v1/kbs/{kb_id}/mcp. "
            "Docs: docs/architecture/openapi-v1.md."
        ),
    }
    schema["servers"] = [{"url": "/", "description": "Basis API host (paths include /api/v1)"}]
    schema.setdefault("components", {})
    schema["components"]["securitySchemes"] = {
        **schema["components"].get("securitySchemes", {}),
        **_security_components(),
    }
    schema["x-basis-surfaces"] = {
        "platform": {
            "description": "Platform & admin APIs for the web console and operators.",
            "auth": "sessionAuth",
            "openapi": "/openapi/v1/platform.json",
        },
        "knowledge-base": {
            "description": "KB-scoped APIs; same access model as MCP (KB API token or user session with KB role).",
            "auth": "sessionAuth or kbApiTokenAuth",
            "openapi": "/openapi/v1/kb.json",
        },
        "console": {
            "description": "Web console application HTTP (not integration/core); excluded from KB integration slice.",
            "auth": "sessionAuth",
            "openapi": "/openapi/v1.json",
        },
    }
    return schema


def filter_openapi_paths(paths: dict, surfaces: set[Surface]) -> dict:
    out: dict = {}
    for path, path_item in paths.items():
        kept = {}
        for method, op in path_item.items():
            if method.startswith("x-") or not isinstance(op, dict):
                continue
            if op.get("x-basis-integration-contract") is False:
                continue
            if op.get("x-basis-audience") == "console":
                continue
            if op.get("x-basis-surface") in surfaces:
                kept[method] = op
        if kept:
            for k, v in path_item.items():
                if k.startswith("x-"):
                    kept[k] = v
            out[path] = kept
    return dict(sorted(out.items()))


def export_openapi_v1_platform(app: FastAPI) -> dict:
    full = export_openapi_v1_document(app)
    part = deepcopy(full)
    part["paths"] = filter_openapi_paths(full["paths"], {"public", "platform"})
    part["info"] = deepcopy(full["info"])
    part["info"]["title"] = "Basis API — platform"
    return part


def export_openapi_v1_kb(app: FastAPI) -> dict:
    full = export_openapi_v1_document(app)
    part = deepcopy(full)
    part["paths"] = filter_openapi_paths(full["paths"], {"public", "knowledge-base"})
    part["info"] = deepcopy(full["info"])
    part["info"]["title"] = "Basis API — kb"
    return part


def cached_openapi_v1_full(app: FastAPI) -> dict:
    cached = getattr(app.state, "_basis_openapi_v1_full", None)
    if cached is None:
        cached = export_openapi_v1_document(app)
        app.state._basis_openapi_v1_full = cached
    return cached


def cached_openapi_v1_platform(app: FastAPI) -> dict:
    cached = getattr(app.state, "_basis_openapi_v1_platform", None)
    if cached is None:
        cached = export_openapi_v1_platform(app)
        app.state._basis_openapi_v1_platform = cached
    return cached


def cached_openapi_v1_kb(app: FastAPI) -> dict:
    cached = getattr(app.state, "_basis_openapi_v1_kb", None)
    if cached is None:
        cached = export_openapi_v1_kb(app)
        app.state._basis_openapi_v1_kb = cached
    return cached
