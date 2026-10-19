"""FastAPI application factory."""

from __future__ import annotations

import asyncio
import threading
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from basis import __version__
from basis.platform.admin.errors import AdminError
from basis.platform.admin.store import AdminStore
from basis.transport.http.routes import health
from basis.transport.http.routes.v1.mount import register_v1_api_routers
from basis.infra.config import Settings
from basis.infra.limits import RuntimeLimits
from basis.infra.database import get_database
from basis.domain.graph.persistence import GraphPersistence
from basis.domain.kb.blob_store import BlobStore
from basis.domain.explorer.registry import ExplorerSessionRegistry
from basis.domain.kb.chunk_search import ChunkSearchService
from basis.domain.kb.store import KnowledgeStore
from basis.platform.realtime.hub import GraphWsHub
from basis.platform.realtime.tickets import RealtimeTicketStore
from basis.infra.capabilities import explorer_available
from basis.transport.http.legacy_api_gate import LegacyApiGateMiddleware
from basis.transport.http.legacy_deprecation import LegacyApiDeprecationMiddleware
from basis.transport.http.rest_v1_concurrency import RestV1ConcurrencyMiddleware
from basis.transport.http.request_id import (
    RequestIdMiddleware,
    attach_request_id_to_detail,
)
from basis.transport.http.routes import openapi_v1 as openapi_v1_routes
from basis.infra.observability.logging_setup import configure_basis_logging


@asynccontextmanager
async def _app_lifespan(app: FastAPI):
    tasks: list[asyncio.Task[None]] = []
    if explorer_available():
        interval = max(30, app.state.settings.explorer_evict_interval_seconds)

        async def _evict_loop() -> None:
            registry = app.state.explorer_registry
            while True:
                await asyncio.sleep(interval)
                registry.evict_idle()

        tasks.append(asyncio.create_task(_evict_loop()))

    poll_tick = int(getattr(app.state.settings, "http_poll_tick_seconds", 0) or 0)
    if poll_tick > 0:
        from basis.domain.kb.ingest_poll_scheduler import run_due_http_polls

        from basis.domain.kb.connector_poll_scheduler import run_due_connector_syncs

        async def _poll_loop() -> None:
            while True:
                await asyncio.sleep(max(15, poll_tick))
                await asyncio.to_thread(run_due_http_polls, app)
                await asyncio.to_thread(run_due_connector_syncs, app)

        tasks.append(asyncio.create_task(_poll_loop()))

    try:
        yield
    finally:
        for task in tasks:
            task.cancel()
        for task in tasks:
            try:
                await task
            except asyncio.CancelledError:
                pass
        executor = getattr(app.state, "ingest_executor", None)
        if executor is not None:
            # Let in-flight ingest finish while the process still has DB handles open.
            executor.shutdown(wait=True, cancel_futures=False)


def create_app(app_settings: Settings | None = None) -> FastAPI:
    app_settings = app_settings or Settings.from_env()
    configure_basis_logging(app_settings)
    app = FastAPI(
        title="Basis API",
        version=__version__,
        lifespan=_app_lifespan,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    app.state.settings = app_settings
    app.state.limits = RuntimeLimits.from_settings(app_settings)
    app.state.ingest_executor = ThreadPoolExecutor(
        max_workers=max(1, app_settings.ingest_max_inflight),
        thread_name_prefix="ingest",
    )
    app.state.ingest_pending_slot = threading.Semaphore(
        max(1, app_settings.ingest_max_pending)
    )
    app.state.database = get_database(
        app_settings.effective_database_url,
        pool_size=app_settings.db_pool_size,
        max_overflow=app_settings.db_max_overflow,
        pool_timeout=app_settings.db_pool_timeout_seconds,
    )
    # Compatibility alias for integrations that still inspect app.state.
    app.state.sqlite_db = app.state.database
    app.state.store = AdminStore(app.state.database)
    app.state.graph_persistence = GraphPersistence(app_settings.data_dir)
    app.state.blob_store = BlobStore(app_settings.data_dir)
    app.state.knowledge_store = KnowledgeStore(app.state.database, app.state.blob_store)
    app.state.chunk_search = ChunkSearchService(
        app.state.knowledge_store,
        app.state.store,
        app_settings.data_dir,
    )
    app.state.graphs = {}
    app.state.explorer_registry = ExplorerSessionRegistry(
        idle_seconds=app_settings.explorer_idle_seconds,
    )
    app.state.realtime_tickets = RealtimeTicketStore()
    app.state.ws_hub = GraphWsHub()
    app.state.mcp_semaphore = asyncio.Semaphore(app_settings.mcp_max_inflight)
    app.state.rest_v1_semaphore = asyncio.Semaphore(app_settings.rest_v1_max_inflight)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://127.0.0.1:5173",
            "http://localhost:5173",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    )
    app.add_middleware(LegacyApiDeprecationMiddleware)
    app.add_middleware(
        LegacyApiGateMiddleware,
        legacy_enabled=app_settings.legacy_api_enabled,
    )
    app.add_middleware(RestV1ConcurrencyMiddleware)
    app.add_middleware(RequestIdMiddleware)

    @app.exception_handler(AdminError)
    async def handle_admin_error(request: Request, exc: AdminError) -> JSONResponse:
        detail = attach_request_id_to_detail(
            request,
            {"code": exc.code, "message": exc.message},
        )
        return JSONResponse(status_code=exc.status, content={"detail": detail})

    @app.exception_handler(HTTPException)
    async def handle_http_exception(request: Request, exc: HTTPException) -> JSONResponse:
        detail = exc.detail
        if isinstance(detail, dict):
            payload = attach_request_id_to_detail(request, dict(detail))
            return JSONResponse(status_code=exc.status_code, content={"detail": payload})
        if isinstance(detail, str):
            payload = attach_request_id_to_detail(request, {"message": detail})
            return JSONResponse(status_code=exc.status_code, content={"detail": payload})
        return JSONResponse(status_code=exc.status_code, content={"detail": detail})

    app.include_router(health.router)
    register_v1_api_routers(
        app,
        legacy_api_enabled=app_settings.legacy_api_enabled,
        include_e2e_helpers=app_settings.data_dir.name == "data-e2e",
    )
    app.include_router(openapi_v1_routes.router)

    from basis.integration.mcp_openapi import bind_openapi_app

    bind_openapi_app(app)

    return app
