"""Build review resolve dependencies from :class:`KbCoreContext`."""

from __future__ import annotations

from basis.core.ledger.services.review_resolve_approve import ReviewApproveDeps
from basis.application.context import KbCoreContext
from basis.application.errors import CoreError


def review_approve_deps(ctx: KbCoreContext) -> ReviewApproveDeps:
    if ctx.runtime_loader is None or ctx.rebuild_projection is None or ctx.persist_graph is None:
        raise CoreError(
            {"code": "internal_error", "message": "graph runtime unavailable for review approve"},
            status_code=500,
        )
    request = ctx.http_request
    if request is None:
        raise CoreError(
            {"code": "internal_error", "message": "review approve requires app request context"},
            status_code=500,
        )
    from basis.api.http.deps import get_blob_store, graph_projection_bindings

    return ReviewApproveDeps(
        projection_bindings=graph_projection_bindings(request),
        blob_store=get_blob_store(request),
        runtime_loader=ctx.runtime_loader,
        persist_graph=ctx.persist_graph,
        rebuild_projection=ctx.rebuild_projection,
    )
