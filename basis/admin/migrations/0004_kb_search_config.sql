-- Per-KB retrieval policy. Backends are named explicitly so additional
-- implementations can be added without changing the API contract.

CREATE TABLE IF NOT EXISTS kb_search_configs (
    kb_id TEXT PRIMARY KEY REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    schema_version INTEGER NOT NULL DEFAULT 1,
    chunk_backend TEXT NOT NULL DEFAULT 'sqlite_ledger',
    vector_backend TEXT NOT NULL DEFAULT 'sqlite_vec',
    embedding_model_id TEXT,
    keyword_enabled INTEGER NOT NULL DEFAULT 1 CHECK (keyword_enabled IN (0, 1)),
    semantic_enabled INTEGER NOT NULL DEFAULT 1 CHECK (semantic_enabled IN (0, 1)),
    default_mode TEXT NOT NULL DEFAULT 'hybrid'
        CHECK (default_mode IN ('keyword', 'semantic', 'hybrid')),
    auto_index INTEGER NOT NULL DEFAULT 1 CHECK (auto_index IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
