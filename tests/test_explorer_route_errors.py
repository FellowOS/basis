"""Unit tests for Explorer HTTP → AdminError mapping."""

from fastapi import HTTPException

from sema.api.explorer_route_errors import admin_error_from_explorer_http


def test_semantic_neighborhood_404_maps_to_code() -> None:
    exc = HTTPException(status_code=404, detail="Node 'x' not found")
    admin = admin_error_from_explorer_http(exc, context="semantic_neighborhood")
    assert admin.status == 404
    assert admin.code == "semantic_node_not_found"


def test_semantic_neighborhood_503_maps_to_code() -> None:
    exc = HTTPException(status_code=503, detail="Semantic similarity is unavailable")
    admin = admin_error_from_explorer_http(exc, context="semantic_neighborhood")
    assert admin.status == 503
    assert admin.code == "semantic_unavailable"
