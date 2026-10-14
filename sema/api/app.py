"""FastAPI application factory."""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from sema import __version__
from sema.admin.errors import AdminError
from sema.admin.store import AdminStore
from sema.api.routes import (
    audit,
    auth,
    health,
    kb_chat,
    kb_explorer,
    kb_ledger,
    kb_mappings,
    kb_ontology,
    kb_review,
    kb_sources,
    kb_tokens,
    kbs,
    mcp,
    model_providers,
    models as models_routes,
    platform,
    realtime,
    reasoning,
    users,
)
from sema.api.routes import settings as settings_routes
from sema.config import Settings
from sema.database import get_database
from sema.graph.persistence import GraphPersistence
from sema.knowledge.blob_store import BlobStore
from sema.explorer.registry import ExplorerSessionRegistry
from sema.knowledge.chunk_search import ChunkSearchService
from sema.knowledge.store import KnowledgeStore
from sema.realtime.hub import GraphWsHub
from sema.realtime.tickets import RealtimeTicketStore
from sema.capabilities import explorer_available


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
        from sema.knowledge.ingest_poll_scheduler import run_due_http_polls

        async def _poll_loop() -> None:
            while True:
                await asyncio.sleep(max(15, poll_tick))
                await asyncio.to_thread(run_due_http_polls, app)

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


def create_app(app_settings: Settings | None = None) -> FastAPI:
    app_settings = app_settings or Settings.from_env()
    app = FastAPI(title="Sema API", version=__version__, lifespan=_app_lifespan)
    app.state.settings = app_settings
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

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://127.0.0.1:5173",
            "http://localhost:5173",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @app.exception_handler(AdminError)
    async def handle_admin_error(_request: Request, exc: AdminError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status,
            content={"detail": {"code": exc.code, "message": exc.message}},
        )

    app.include_router(health.router)
    app.include_router(platform.router)
    app.include_router(auth.router)
    app.include_router(users.router)
    app.include_router(kbs.router)
    app.include_router(kb_chat.router)
    app.include_router(mcp.router)
    app.include_router(kb_tokens.router)
    app.include_router(kb_explorer.router)
    app.include_router(kb_ontology.router)
    app.include_router(kb_review.router)
    app.include_router(kb_ledger.router)
    app.include_router(kb_mappings.router)
    app.include_router(kb_sources.router)
    app.include_router(realtime.router)
    app.include_router(settings_routes.router)
    app.include_router(model_providers.router)
    app.include_router(models_routes.router)
    app.include_router(audit.router)
    app.include_router(reasoning.router)
    return app
