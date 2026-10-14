"""Process settings loaded from the environment."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


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

    @property
    def db_path(self) -> Path:
        return self.data_dir / "sema.db"

    @property
    def effective_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        return f"sqlite:///{self.db_path.resolve()}"

    @property
    def database_backend(self) -> str:
        return "postgres" if self.effective_database_url.startswith("postgres") else "sqlite"

    @classmethod
    def from_env(cls) -> "Settings":
        load_dotenv()
        return cls(
            host=os.environ.get("SEMA_HOST", "127.0.0.1"),
            port=int(os.environ.get("SEMA_PORT", "8090")),
            data_dir=Path(os.environ.get("SEMA_DATA_DIR", "data")),
            explorer_idle_seconds=int(os.environ.get("SEMA_EXPLORER_IDLE_SECONDS", "1800")),
            explorer_evict_interval_seconds=int(
                os.environ.get("SEMA_EXPLORER_EVICT_INTERVAL_SECONDS", "300")
            ),
            database_url=os.environ.get("SEMA_DATABASE_URL") or None,
            db_pool_size=int(os.environ.get("SEMA_DB_POOL_SIZE", "10")),
            db_max_overflow=int(os.environ.get("SEMA_DB_MAX_OVERFLOW", "20")),
            db_pool_timeout_seconds=int(os.environ.get("SEMA_DB_POOL_TIMEOUT_SECONDS", "30")),
            mcp_max_inflight=int(os.environ.get("SEMA_MCP_MAX_INFLIGHT", "32")),
            mcp_timeout_seconds=int(os.environ.get("SEMA_MCP_TIMEOUT_SECONDS", "60")),
        )
