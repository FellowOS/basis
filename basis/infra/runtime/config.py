"""Process settings loaded from the environment."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


def _bounded_int(name: str, default: int, *, lo: int, hi: int) -> int:
    raw = os.environ.get(name)
    if raw is None or not str(raw).strip():
        return default
    return max(lo, min(hi, int(raw)))


@dataclass(frozen=True)
class Settings:
    host: str = "127.0.0.1"
    port: int = 8090
    data_dir: Path = Path("data")
    explorer_idle_seconds: int = 1800
    explorer_evict_interval_seconds: int = 300
    database_url: str | None = None
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_timeout_seconds: int = 30
    mcp_max_inflight: int = 32
    mcp_timeout_seconds: int = 60
    rest_v1_max_inflight: int = 64
    legacy_api_enabled: bool = False
    ingest_inline: bool = False
    http_poll_tick_seconds: int = 0
    governor_tick_seconds: int = 0
    log_json: bool = False
    graph_page_max_nodes: int = 200
    graph_page_max_edges: int = 400
    chunk_search_max_limit: int = 50
    explorer_decisions_max_limit: int = 200
    graph_node_search_max_limit: int = 50
    import_max_bytes: int = 50 * 1024 * 1024
    upload_max_bytes: int = 50 * 1024 * 1024
    ingest_max_inflight: int = 4
    ingest_max_pending: int = 32
    processing_job_timeout_seconds: int = 600
    ingest_max_extract_chars: int = 2_000_000
    ingest_max_chunks: int = 2_000
    ingest_extract_timeout_seconds: int = 300
    deployment_profile: str = "server"

    @property
    def is_desktop(self) -> bool:
        return self.deployment_profile == "desktop"

    @property
    def auth_enabled(self) -> bool:
        return not self.is_desktop

    @property
    def db_path(self) -> Path:
        return self.data_dir / "basis.db"

    @property
    def effective_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        return f"sqlite:///{self.db_path.resolve()}"

    @property
    def database_backend(self) -> str:
        return "postgres" if self.effective_database_url.startswith("postgres") else "sqlite"

    @classmethod
    def from_env(cls, *, profile_spec: str | None = None) -> "Settings":
        load_dotenv()
        from basis.infra.runtime.deployment_profile import bootstrap_profile_from_env

        bootstrap_profile_from_env(profile_spec)
        return cls(
            host=os.environ.get("BASIS_HOST", "127.0.0.1"),
            port=int(os.environ.get("BASIS_PORT", "8090")),
            data_dir=Path(os.environ.get("BASIS_DATA_DIR", "data")),
            explorer_idle_seconds=int(os.environ.get("BASIS_EXPLORER_IDLE_SECONDS", "1800")),
            explorer_evict_interval_seconds=int(
                os.environ.get("BASIS_EXPLORER_EVICT_INTERVAL_SECONDS", "300")
            ),
            database_url=os.environ.get("BASIS_DATABASE_URL") or None,
            db_pool_size=int(os.environ.get("BASIS_DB_POOL_SIZE", "10")),
            db_max_overflow=int(os.environ.get("BASIS_DB_MAX_OVERFLOW", "20")),
            db_pool_timeout_seconds=int(os.environ.get("BASIS_DB_POOL_TIMEOUT_SECONDS", "30")),
            mcp_max_inflight=int(os.environ.get("BASIS_MCP_MAX_INFLIGHT", "32")),
            mcp_timeout_seconds=int(os.environ.get("BASIS_MCP_TIMEOUT_SECONDS", "60")),
            rest_v1_max_inflight=int(os.environ.get("BASIS_REST_V1_MAX_INFLIGHT", "64")),
            legacy_api_enabled=os.environ.get("BASIS_LEGACY_API_ENABLED", "0").lower()
            in ("1", "true", "yes"),
            ingest_inline=os.environ.get("BASIS_INGEST_INLINE", "").lower() in ("1", "true", "yes"),
            http_poll_tick_seconds=int(os.environ.get("BASIS_HTTP_POLL_TICK_SECONDS", "0")),
            governor_tick_seconds=int(os.environ.get("BASIS_GOVERNOR_TICK_SECONDS", "0")),
            log_json=os.environ.get("BASIS_LOG_JSON", "").lower() in ("1", "true", "yes"),
            graph_page_max_nodes=_bounded_int(
                "BASIS_GRAPH_PAGE_MAX_NODES", 200, lo=1, hi=5000
            ),
            graph_page_max_edges=_bounded_int(
                "BASIS_GRAPH_PAGE_MAX_EDGES", 400, lo=1, hi=10000
            ),
            chunk_search_max_limit=_bounded_int(
                "BASIS_CHUNK_SEARCH_MAX_LIMIT", 50, lo=1, hi=500
            ),
            explorer_decisions_max_limit=_bounded_int(
                "BASIS_EXPLORER_DECISIONS_MAX_LIMIT", 200, lo=1, hi=2000
            ),
            graph_node_search_max_limit=_bounded_int(
                "BASIS_GRAPH_NODE_SEARCH_MAX_LIMIT", 50, lo=1, hi=500
            ),
            import_max_bytes=_bounded_int(
                "BASIS_IMPORT_MAX_BYTES",
                50 * 1024 * 1024,
                lo=1024,
                hi=200 * 1024 * 1024,
            ),
            upload_max_bytes=_bounded_int(
                "BASIS_UPLOAD_MAX_BYTES",
                50 * 1024 * 1024,
                lo=1024,
                hi=200 * 1024 * 1024,
            ),
            ingest_max_inflight=_bounded_int("BASIS_INGEST_MAX_INFLIGHT", 4, lo=1, hi=64),
            ingest_max_pending=_bounded_int("BASIS_INGEST_MAX_PENDING", 32, lo=1, hi=10_000),
            processing_job_timeout_seconds=_bounded_int(
                "BASIS_PROCESSING_JOB_TIMEOUT_SECONDS",
                600,
                lo=30,
                hi=7200,
            ),
            ingest_max_extract_chars=_bounded_int(
                "BASIS_INGEST_MAX_EXTRACT_CHARS",
                2_000_000,
                lo=10_000,
                hi=20_000_000,
            ),
            ingest_max_chunks=_bounded_int("BASIS_INGEST_MAX_CHUNKS", 2_000, lo=1, hi=50_000),
            ingest_extract_timeout_seconds=_bounded_int(
                "BASIS_INGEST_EXTRACT_TIMEOUT_SECONDS",
                300,
                lo=0,
                hi=7200,
            ),
            deployment_profile=os.environ.get("BASIS_DEPLOYMENT_PROFILE", "server").strip().lower()
            or "server",
        )

    def validate_for_startup(self) -> None:
        if not self.is_desktop:
            return
        if self.deployment_profile != "desktop":
            raise SystemExit(f"Unsupported BASIS_DEPLOYMENT_PROFILE: {self.deployment_profile}")
        loopback_hosts = {"127.0.0.1", "localhost", "::1"}
        if self.host.strip() not in loopback_hosts:
            raise SystemExit("desktop profile requires loopback BASIS_HOST (127.0.0.1)")
        if self.database_backend == "postgres":
            raise SystemExit("desktop profile requires SQLite (unset BASIS_DATABASE_URL)")
