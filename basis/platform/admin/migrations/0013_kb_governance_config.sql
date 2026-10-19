-- Per-KB agent governor schedule (F-GOV-04 Phase B).

CREATE TABLE IF NOT EXISTS kb_governance_configs (
    kb_id TEXT PRIMARY KEY REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    schema_version INTEGER NOT NULL DEFAULT 1,
    governor_enabled INTEGER NOT NULL DEFAULT 0 CHECK (governor_enabled IN (0, 1)),
    governor_interval_minutes INTEGER NOT NULL DEFAULT 1440 CHECK (governor_interval_minutes >= 0),
    governor_confidence_min REAL NOT NULL DEFAULT 0.75,
    governor_last_run_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
