CREATE TABLE IF NOT EXISTS kb_alerts (
    id TEXT PRIMARY KEY,
    kb_id TEXT NOT NULL REFERENCES knowledge_bases(id),
    kind TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'warning',
    message TEXT NOT NULL,
    detail_json TEXT,
    created_at TEXT NOT NULL,
    read_at TEXT,
    dismissed_at TEXT
);

CREATE INDEX IF NOT EXISTS kb_alerts_kb_created
    ON kb_alerts(kb_id, created_at DESC)
    WHERE dismissed_at IS NULL;
